import m from "mithril";

import { Charger, ChargerStatus } from "./charger";
import { SelectInput } from "./select";
import "./style.css";

interface Model {
  name: string;
  voltage: number;
  current: number;
}
const models: Model[] = [
  {
    name: "LeaperKim Lynx (Max)",
    voltage: 151.2,
    current: 18,
  },
  {
    name: "LeaperKim Lynx (Casual)",
    voltage: 4.15 * 36,
    current: 5,
  },
  {
    name: "Begode Master (Max)",
    voltage: 134.4,
    current: 10,
  },
  {
    name: "Off",
    voltage: 0,
    current: 0,
  },
];
let selectedModel: Model | undefined;

const charger = new Charger();
(window as any).charger = charger;

const onChangeModel = async (model: Model) => {
  selectedModel = model;
  if (model.voltage === 0 || model.current === 0) {
    charger.setOutputEnabled(false);
  } else {
    await charger.setOutputEnabled(true);
    await charger.setOutputVoltage(model.voltage);
    await charger.setOutputCurrent(model.current);
  }
};

interface StatusRowAttrs {
  name: string;
  value: (status: ChargerStatus) => number;
  display: (value: number) => string | number;
}
const StatusRow: m.Component<StatusRowAttrs> = {
  view({ attrs: { name, value, display } }) {
    const status = charger.currentStatus();
    const displayValue = status && display(value(status));
    return [m(".status-name", name), m(".status-value", displayValue ?? "∅")];
  },
};

const MainComponent: m.Component = {
  view() {
    return [
      charger.isConnected() && [
        m(".status", [
          m(StatusRow, {
            name: "AC Input Voltage",
            value: (status: ChargerStatus) => status.acInputVoltage,
            display: (value: number) => value.toFixed(1) + "v",
          }),
          m(StatusRow, {
            name: "AC Input Current",
            value: (status: ChargerStatus) => status.acInputCurrent,
            display: (value: number) => value.toFixed(1) + "a",
          }),
          m(StatusRow, {
            name: "AC Input Power",
            value: (status: ChargerStatus) => status.acInputVoltage * status.acInputCurrent,
            display: (value: number) => value.toFixed(1) + "w",
          }),
          m(StatusRow, {
            name: "AC Input Frequency",
            value: (status: ChargerStatus) => status.acInputFrequency,
            display: (value: number) => value.toFixed(1) + "hz",
          }),
          m(StatusRow, {
            name: "DC Output Voltage",
            value: (status: ChargerStatus) => status.dcOutputVoltage,
            display: (value: number) => value.toFixed(1) + "v",
          }),
          m(StatusRow, {
            name: "DC Output Current",
            value: (status: ChargerStatus) => status.dcOutputCurrent,
            display: (value: number) => value.toFixed(2) + "a",
          }),
          m(StatusRow, {
            name: "DC Output Power",
            value: (status: ChargerStatus) => status.dcOutputVoltage * status.dcOutputCurrent,
            display: (value: number) => value.toFixed(1) + "w",
          }),
          m(StatusRow, {
            name: "Temperature 1",
            value: (status: ChargerStatus) => status.temperature1,
            display: (value: number) => value.toFixed(0) + "°",
          }),
          m(StatusRow, {
            name: "Temperature 2",
            value: (status: ChargerStatus) => status.temperature2,
            display: (value: number) => value.toFixed(0) + "°",
          }),
          m(StatusRow, {
            name: "Efficiency",
            value: (status: ChargerStatus) => status.efficiency,
            display: (value: number) => value.toFixed(1) + "%",
          }),
          m(StatusRow, {
            name: "Current Limiting Point",
            value: (status: ChargerStatus) => status.currentLimitingPoint,
            display: (value: number) => value.toFixed(1) + "%",
          }),
        ]),
        m(SelectInput, {
          className: "model-select",
          options: models.map((m) => m.name),
          selected: selectedModel?.name,
          onChange: (index: number) => {
            onChangeModel(models[index]);
          },
        }),
      ],
      m(
        "button",
        {
          onclick: async () => {
            if (charger.isConnected()) {
              charger.disconnect();
            } else {
              try {
                charger.connect();
              } catch (err) {}
            }
          },
        },
        charger.isConnected() ? "Disconnect" : "Connect"
      ),
    ];
  },
};

const init = async () => {
  const appElem = document.getElementById("app");
  m.mount(appElem!, MainComponent);
};
document.addEventListener("DOMContentLoaded", init);
