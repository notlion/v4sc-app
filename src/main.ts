import m from "mithril";
import "./style.css";

const serviceId = 0xffe1;
const readCharacteristicId = 0xffe2;
const writeCharacteristicId = 0xffe3;

let device: BluetoothDevice | undefined;
let writeCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
let readCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
let pollInterval: number | undefined;

let currentStatus: Uint8Array | undefined;

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
  if (!readCharacteristic.value) return;
  currentStatus = new Uint8Array(readCharacteristic.value.buffer);
  m.redraw();
};

const MainComponent: m.Component = {
  view() {
    const isConnected = device !== undefined;
    return [
      currentStatus &&
        m(
          "p",
          Array.from(currentStatus)
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join(" ")
        ),
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
