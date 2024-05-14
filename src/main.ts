import m from "mithril";

import "./style.css";
import { SelectInput } from "./select";
import { Charger } from "./charger";

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
    voltage: 150,
    current: 5,
  },
  {
    name: "Begode Master (Max)",
    voltage: 134.4,
    current: 10,
  },
];
let selectedModel = models[1];

const charger = new Charger();
(window as any).charger = charger;

const onChangeModel = async (model: Model) => {
  selectedModel = model;
  await charger.setOutputVoltage(model.voltage);
  await charger.setOutputCurrent(model.current);
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
    const currentStatus = charger.currentStatus();
    return [
      charger.isConnected() && [
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
        m(SelectInput, {
          className: "model-select",
          options: models.map((m) => m.name),
          selected: selectedModel.name,
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
              charger.connect();
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
