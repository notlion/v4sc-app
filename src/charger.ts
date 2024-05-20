import m from "mithril";

const serviceId = 0xffe1;
const readCharacteristicId = 0xffe2;
const writeCharacteristicId = 0xffe3;

const writeRequestSetpointBytes = [0x02, 0x05, 0x05];
const writeRequestStatusBytes = [0x02, 0x06, 0x06];
const writeOutputVoltageBytes = [0x06, 0x07];
const writeOutputCurrentBytes = [0x06, 0x08];
const writeOutputDisabledBytes = [0x06, 0x0c];

const setpointUpdateCode = 0x0565;
const statusUpdateCode = 0x0630;
const setOutputVoltageResponseCode = 0x0703;
const setOutputVoltageErrorCode = 0x0700;
const setOutputVoltageSuccessCode = 0x0801;
const setOutputCurrentResponseCode = 0x0803;
const setOutputCurrentErrorCode = 0x0800;
const setOutputCurrentSuccessCode = 0x0901;

export interface ChargerStatus {
  time: number;

  acInputVoltage: number;
  acInputCurrent: number;

  dcOutputVoltage: number;
  dcOutputCurrent: number;

  acInputFrequency: number;

  efficiency: number;
  currentLimitingPoint: number;

  temperature1: number;
  temperature2: number;
}

export interface ChargerSetpoint {
  voltage: number;
  current: number;
}

export class Charger {
  status: ChargerStatus[];

  setpoint: ChargerSetpoint;

  device?: BluetoothDevice;
  writeCharacteristic?: BluetoothRemoteGATTCharacteristic;
  readCharacteristic?: BluetoothRemoteGATTCharacteristic;

  pollInterval?: number;

  constructor() {
    this.status = [];
    this.setpoint = { voltage: 0, current: 0 };
  }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [serviceId] }],
    });
    this.device.addEventListener("gattserverdisconnected", () => {
      this.disconnect();
      m.redraw();
    });

    const server = await this.device.gatt?.connect();
    const service = await server?.getPrimaryService(serviceId);
    if (service) {
      this.writeCharacteristic = await service.getCharacteristic(writeCharacteristicId);
      this.readCharacteristic = await service.getCharacteristic(readCharacteristicId);
      if (this.readCharacteristic) {
        this.readCharacteristic.addEventListener("characteristicvaluechanged", () => {
          this.onReadCharacteristicChanged();
        });
        this.readCharacteristic.startNotifications();
      }
      if (this.writeCharacteristic) {
        this.writeCharacteristic.writeValue(new Uint8Array(writeRequestSetpointBytes));
      }
      this.pollInterval = setInterval(() => this.onPollInterval(), 2000);
    }
  }

  disconnect() {
    clearInterval(this.pollInterval);
    this.pollInterval = undefined;
    this.writeCharacteristic = undefined;
    this.readCharacteristic = undefined;
    this.device?.gatt?.disconnect();
    this.device = undefined;
  }

  isConnected() {
    return (
      this.device !== undefined &&
      this.writeCharacteristic !== undefined &&
      this.readCharacteristic !== undefined
    );
  }

  currentStatus() {
    if (this.status.length < 1) return;
    return this.status[this.status.length - 1];
  }

  async setOutputVoltage(dcVoltage: number) {
    this.setpoint.voltage = dcVoltage;
    if (!this.writeCharacteristic) return;
    const array = new Uint8Array(7);
    const view = new DataView(array.buffer);
    view.setUint8(0, writeOutputVoltageBytes[0]);
    view.setUint8(1, writeOutputVoltageBytes[1]);
    view.setFloat32(2, dcVoltage, true);
    view.setUint8(6, checksum(view, 1, 5));
    return this.writeCharacteristic.writeValue(array);
  }

  async setOutputCurrent(dcCurrent: number) {
    this.setpoint.current = dcCurrent;
    if (!this.writeCharacteristic) return;
    const array = new Uint8Array(7);
    const view = new DataView(array.buffer);
    view.setUint8(0, writeOutputCurrentBytes[0]);
    view.setUint8(1, writeOutputCurrentBytes[1]);
    view.setFloat32(2, dcCurrent, true);
    view.setUint8(6, checksum(view, 1, 5));
    return this.writeCharacteristic.writeValue(array);
  }

  async setOutputEnabled(enabled: boolean) {
    if (!this.writeCharacteristic) return;
    const array = new Uint8Array(7);
    const view = new DataView(array.buffer);
    view.setUint8(0, writeOutputDisabledBytes[0]);
    view.setUint8(1, writeOutputDisabledBytes[1]);
    view.setUint32(2, enabled ? 0 : 1, true);
    view.setUint8(6, checksum(view, 1, 5));
    // console.log(Array.from(array).map((x) => x.toString(16).padStart(2, "0")));
    return this.writeCharacteristic.writeValue(array);
  }

  private onReadCharacteristicChanged() {
    if (!this.readCharacteristic?.value) return;

    const { value } = this.readCharacteristic;
    const code = value.getUint16(0, true);
    if (code === statusUpdateCode) {
      this.status.push({
        time: Date.now(),
        acInputVoltage: value.getFloat32(2, true),
        acInputCurrent: value.getFloat32(6, true),
        acInputFrequency: value.getFloat32(10, true),
        temperature1: value.getFloat32(14, true),
        temperature2: value.getFloat32(18, true),
        dcOutputVoltage: value.getFloat32(22, true),
        dcOutputCurrent: value.getFloat32(26, true),
        currentLimitingPoint: value.getFloat32(30, true),
        efficiency: value.getFloat32(34, true),
      });
    } else if (code === setpointUpdateCode) {
      this.setpoint = {
        voltage: value.getFloat32(2, true),
        current: value.getFloat32(6, true),
      };
      // console.log("Not sure what else is in here", value);
    } else if (code === setOutputVoltageResponseCode) {
      const subCode = value.getUint16(2, true);
      if (subCode === setOutputVoltageSuccessCode) {
      } else if (subCode === setOutputVoltageErrorCode) {
        console.error("Error setting output voltage.");
      }
    } else if (code === setOutputCurrentResponseCode) {
      const subCode = value.getUint16(2, true);
      if (subCode === setOutputCurrentSuccessCode) {
      } else if (subCode === setOutputCurrentErrorCode) {
        console.error("Error setting output current.");
      }
    }

    m.redraw();
  }

  private onPollInterval() {
    if (!this.writeCharacteristic) return;
    this.writeCharacteristic.writeValue(new Uint8Array(writeRequestStatusBytes));
  }
}

const checksum = (view: DataView, byteOffset: number, byteCount: number) => {
  let sum = 0;
  for (let i = 0; i < byteCount; ++i) {
    sum += view.getUint8(byteOffset + i);
    sum %= 256;
  }
  return sum;
};
