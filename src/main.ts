import m from "mithril";
import "./style.css";

const serviceId = 0xffe1;
const readCharacteristicId = 0xffe2;
const writeCharacteristicId = 0xffe3;

let device: BluetoothDevice | undefined;
let writeCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
let readCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
let pollInterval: number | undefined;

interface ChargerStatus {
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

let currentStatus: ChargerStatus | undefined;

const statusSamples: Uint8Array[] = [];

const connect = async () => {
  device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [serviceId] }],
  });
  device.ongattserverdisconnected = disconnect;

  const server = await device.gatt?.connect();
  const service = await server?.getPrimaryService(serviceId);
  if (service) {
    writeCharacteristic = await service.getCharacteristic(writeCharacteristicId);
    readCharacteristic = await service.getCharacteristic(readCharacteristicId);
    if (readCharacteristic) {
      readCharacteristic.addEventListener("characteristicvaluechanged", onStatusChanged);
      readCharacteristic.startNotifications();
    }
  }
  console.log(readCharacteristic, writeCharacteristic);

  pollInterval = setInterval(onPollInterval, 2000);

  m.redraw();
};
const disconnect = () => {
  clearInterval(pollInterval);
  pollInterval = undefined;
  device = undefined;
  readCharacteristic = undefined;
  writeCharacteristic = undefined;
};

const onPollInterval = () => {
  if (!writeCharacteristic) return;
  writeCharacteristic.writeValue(new Uint8Array([0x02, 0x06, 0x06]));
};

const onStatusChanged = () => {
  if (!readCharacteristic) return;

  const { value } = readCharacteristic;
  if (!value) return;
  console.assert(value.getUint8(0) === 48);

  currentStatus = {
    acInputVoltage: value.getFloat32(2, true),
    acInputCurrent: value.getFloat32(6, true),
    acInputFrequency: value.getFloat32(10, true),
    temperature1: value.getFloat32(14, true),
    temperature2: value.getFloat32(18, true),
    dcOutputVoltage: value.getFloat32(22, true),
    dcOutputCurrent: value.getFloat32(26, true),
    currentLimitingPoint: value.getFloat32(30, true),
    efficiency: value.getFloat32(34, true),
  };

  statusSamples.push(new Uint8Array(value.buffer));
  m.redraw();
};

interface StatusRowAttrs {
  name: string;
  value?: string | number;
}
const StatusRow: m.Component<StatusRowAttrs> = {
  view({ attrs: { name, value } }) {
    return [m(".status-name", name), m(".status-value", value ?? "∅")];
  },
};

const MainComponent: m.Component = {
  view() {
    const isConnected = device !== undefined;
    return [
      currentStatus &&
        m(".status", [
          m(StatusRow, {
            name: "AC Input Voltage",
            value: currentStatus.acInputVoltage.toFixed(1) + "v",
          }),
          m(StatusRow, {
            name: "AC Input Current",
            value: currentStatus.acInputCurrent.toFixed(1) + "a",
          }),
          m(StatusRow, {
            name: "AC Input Frequency",
            value: currentStatus.acInputFrequency.toFixed(1) + "hz",
          }),
          m(StatusRow, {
            name: "DC Output Voltage",
            value: currentStatus.dcOutputVoltage.toFixed(1) + "v",
          }),
          m(StatusRow, {
            name: "DC Output Current",
            value: currentStatus.dcOutputCurrent.toFixed(2) + "a",
          }),
          m(StatusRow, {
            name: "Temperature 1",
            value: currentStatus.temperature1.toFixed(0) + "°",
          }),
          m(StatusRow, {
            name: "Temperature 2",
            value: currentStatus.temperature2.toFixed(0) + "°",
          }),
          m(StatusRow, {
            name: "Efficiency",
            value: currentStatus.efficiency.toFixed(1) + "%",
          }),
          m(StatusRow, {
            name: "Current Limiting Point",
            value: currentStatus.currentLimitingPoint.toFixed(1) + "%",
          }),
        ]),
      // statusSamples.map((status, index) => {
      //   const bytes = Array.from(status);
      //   const prevBytes = index > 0 && Array.from(statusSamples[index - 1]);
      //   return m(
      //     ".bytes",
      //     bytes.map((byte, i) => {
      //       const prevByte = prevBytes ? prevBytes[i] : byte;
      //       return m(
      //         "span.byte",
      //         { className: prevByte !== byte ? "different" : undefined },
      //         byte.toString(16).padStart(2, "0")
      //       );
      //     })
      //   );
      // }),
      m(
        "button",
        {
          onclick: () => {
            if (isConnected) disconnect();
            else connect();
          },
        },
        isConnected ? "Disconnect" : "Connect"
      ),
    ];
  },
};

const init = () => {
  const appElem = document.getElementById("app");
  m.mount(appElem!, MainComponent);
};
document.addEventListener("DOMContentLoaded", init);
