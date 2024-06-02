import m from "mithril";
import { WheelModel, ModelsDB } from "./wheelmodel";

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

  modelsDB = new ModelsDB();
  model?: WheelModel;
  autoDetectedModel = false;

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
    if (this.status.length < 1) return Charger.emptyStatus();
    return this.status[this.status.length - 1];
  }

  static emptyStatus(): ChargerStatus {
    return {
      time: 0,
      acInputVoltage: 0,
      acInputCurrent: 0,
      dcOutputVoltage: 0,
      dcOutputCurrent: 0,
      acInputFrequency: 0,
      efficiency: 0,
      currentLimitingPoint: 0,
      temperature1: 0,
      temperature2: 0,
    };
  }

  getCellCount() {
    if (!this.model) {
      const outV = this.currentStatus().dcOutputVoltage;
      this.model = this.modelsDB.detectModel(this.setpoint.voltage, outV);
      if (this.model) this.autoDetectedModel = true;
    }
    return this.model?.seriescells;
  }

  static getChargeCurve() {
    return [
      [4.20, 100],
      [4.15, 99],
      [4.07, 95],
      [4.04, 90],
      [3.99, 80],
      [3.87, 70],
      [3.79, 60],
      [3.7, 50],
      [3.61, 40],
      [3.54, 30],
      [3.44, 20],
      [3.33, 10],
      [3.15, 5],
      [3.0, 0],
    ];
  }

  static getSOCFromVoltage(voltage: number) {
    const chargeCurve = Charger.getChargeCurve();
    //interpolate between points in charge curve
    let upperPoint = chargeCurve[0];
    for (let i = 1; i < chargeCurve.length; i++) {
      const lowerPoint = chargeCurve[i];
      if (voltage > lowerPoint[0] || i === chargeCurve.length - 1) {
        const percent = (voltage - lowerPoint[0]) / (upperPoint[0] - lowerPoint[0]);
        return lowerPoint[1] + percent * (upperPoint[1] - lowerPoint[1]);
      }
      upperPoint = lowerPoint;
    }
    return upperPoint[1]; //minimum
  }

  static getVoltageForSoc(soc: number) {
    const chargeCurve = Charger.getChargeCurve();
    let upperPoint = chargeCurve[0];
    for (let i = 1; i < chargeCurve.length; i++) {
      const lowerPoint = chargeCurve[i];
      if (soc > lowerPoint[1] || i === chargeCurve.length - 1) {
        const percent = (soc - lowerPoint[1]) / (upperPoint[1] - lowerPoint[1]);
        return lowerPoint[0] + percent * (upperPoint[0] - lowerPoint[0]);
      }
      upperPoint = lowerPoint;
    }
    return upperPoint[0]; //minimum
  }

  getSetpointSoc() {
    const voltage = this.setpoint.voltage;
    const cellCount = this.getCellCount();
    if (!voltage || !cellCount) return;
    return Charger.getSOCFromVoltage(voltage / cellCount);
  }

  getTotalInternalImpedance() {
    //TODO add peturb and observe method (on interval) for internal impedance
    const model = this.model;
    if (!model) return 0.022 / 4 * 36;
    return model.totalOhms;
  }

  getRestV() {
    const status = this.currentStatus();
    if (!status) return;
    const ir = this.getTotalInternalImpedance();
    return (status.dcOutputVoltage - status.dcOutputCurrent * ir);
  }

  getRestCellV() {
    const cellCount = this.getCellCount();
    const restV = this.getRestV();
    if (!cellCount || !restV) return;
    return restV / cellCount;
  }

  getStateOfCharge() {
    const restCellV = this.getRestCellV();
    if (!restCellV) return;
    return Charger.getSOCFromVoltage(restCellV);
  }

  getTimeEstimateSoc(targetSOCIn: number | undefined = undefined) {
    const soc = this.getStateOfCharge();
    const status = this.currentStatus();
    const targetSOC = targetSOCIn ?? this.getSetpointSoc();
    const capWh = this.model?.capacityWh;
    if (!soc || !status || !targetSOC || !capWh) return;
    const power = status.dcOutputVoltage * status.dcOutputCurrent;
    const time = ((targetSOC - soc)/100 * capWh) / power * 3600; //in seconds
    return Math.max(0, time);
  }

  getCapacityAh() {
    const cellCount = this.getCellCount();
    const capWh = this.model?.capacityWh;
    if (!cellCount || !capWh) return;
    return capWh / Charger.getVoltageForSoc(50) / cellCount;
  }

  getAsymptoteSOC() {
    const volt = this.setpoint.voltage;
    const curr = this.setpoint.current;
    const cellCount = this.getCellCount();
    if (!cellCount || volt < 3.0 * cellCount || curr < 0.1) return;
    const ir = this.getTotalInternalImpedance();
    const restV = volt - curr * ir;
    return Charger.getSOCFromVoltage(restV / cellCount);
  }

  static timeStr(seconds: number) {
    if (seconds >= Infinity)
      return "∞";
    if (seconds < 3600)
      return (seconds / 60).toFixed() + "m";
    return (seconds / 3600).toFixed(1) + "h";
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

  isOutputEnabled() {
    const status = this.currentStatus();
    return status && status.dcOutputVoltage > 50;
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
      if (this.autoDetectedModel)
        this.model = undefined;
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


export const charger = new Charger();

