import m from "mithril";

import { SelectInput } from "./select";
import { Charger } from "./charger";
import "./style.css";
import vers from "./git-version.json";

interface Model {
  name: string;
  voltage: number;
  current: number;
}
const models: Model[] = [
  {
    name: "Off",
    voltage: 0,
    current: 0,
  },
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
];

const cloneModel = (model: Model): Model => {
  return {
    name: "Custom",
    voltage: model.voltage,
    current: model.current,
  };
};
let currentModel = cloneModel(models[0]);

const charger = new Charger();
(window as any).charger = charger;

const onChangeModel = async (model: Model) => {
  currentModel = model;
  if (model.voltage === 0 || model.current === 0) {
    charger.setOutputEnabled(false);
  } else {
    await charger.setOutputEnabled(true);
    await charger.setOutputVoltage(model.voltage);
    await charger.setOutputCurrent(model.current);
  }
};

const MainComponent: m.Component = {
  view() {
    const s = charger.currentStatus() ?? Charger.emptyStatus();
    const soc = charger.getStateOfCharge();
    const goalSOC = charger.getSetpointSoc();
    const goalSOCShow = (!goalSOC || goalSOC > 90)? 90 : goalSOC;
    const timeEst = charger.getTimeEstimateSoc(goalSOCShow);
    const restCellV = charger.getRestCellV() ?? 0;
    const cellCount = charger.getCellCount() ?? 0;
    return [
      m(".status", [
        m("h2", [
          m(".val", (soc? soc.toFixed(1) : "NA") + "%" ),
        ]),
        m("h3", [
          m(".val", (timeEst? Charger.timeStr(timeEst) : "∞")),
          m(".sub", ["until " + goalSOCShow + "%"]),
        ]),
        m("h4", [
          m(".val", s.dcOutputCurrent.toFixed(1) + "A"),
          m(".val .sub", (s.dcOutputVoltage * s.dcOutputCurrent).toFixed(1) + "W"),
        ]),
        m("h4", [
          m(".val", (Math.max(s.temperature1, s.temperature2)).toFixed(0) + "C"),
          m(".val .sub", ("AC " + s.acInputVoltage.toFixed(0) + "V " + s.acInputCurrent.toFixed(1) + "A")),
          // also could add s.acInputFrequency
        ]),
        m("h4", [
          m(".val", (goalSOC ?? 0).toFixed(0) + "%"),
          m(".sub", "setpoint"),
        ]),
        m("h4", [
          m(".val", restCellV.toFixed(2) + "V"),
          m(".val .sub", restCellV * cellCount + "V@rest " + cellCount + "S"),
        ]),

      ]),
      m(".input-group", [
        m("label", "Setpoint SOC"),
        m(NumberInput, {
          value: charger.getSetpointSoc() ?? 95,
          onChange: (soc: number) => {
            const cellcount = charger.getCellCount();
            if (!cellcount) return;
            const vgoal = Charger.getVoltageForSoc(soc) * cellcount;
            charger.setOutputVoltage(vgoal);
            //update other number inputs
          },
        }),
      ]),
      m(NumberInput, {
        value: charger.setpoint.voltage,
        onChange: (voltage: number) => {
          charger.setOutputVoltage(voltage);
        },
      }),
      m(NumberInput, {
        value: charger.setpoint.current,
        onChange: (current: number) => {
          charger.setOutputCurrent(current);
        },
      }),
      m(SelectInput, {
        className: "model-select",
        options: models.map((m) => m.name),
        selected: currentModel?.name,
        onChange: (index: number) => {
          onChangeModel(models[index]);
        },
      }),
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
      navigator.bluetooth ? "" : (m("p", "Web Bluetooth not available, try Chrome or ", m("a", { href: "https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055" }, "Bluefy"))),
      m("footer", [
        m("p", "Open source on ", m("a", { href: "http://github.com/notlion/v4sc-app" }, "github")),
        m(".sub", "Version ", vers),
      ]),
    ];
  },
};

interface NumberInputAttrs {
  value: number;
  onChange: (value: number) => void;
}
const NumberInput: m.Component<NumberInputAttrs> = {
  view() {
    return m("input[type=number,inputmode=numeric]", { spellcheck: false });
  },
  oncreate(vnode) {
    const elem = vnode.dom;
    if (elem instanceof HTMLInputElement) {
      elem.value = vnode.attrs.value.toFixed(1);
      elem.addEventListener("blur", () => {
        vnode.attrs.onChange(Number(elem.value));
        m.redraw();
      });
      elem.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.code == "Enter") {
          event.preventDefault();
          elem.blur();
        }
      });
    }
  },
  onupdate(vnode) {
    const elem = vnode.dom;
    if (elem instanceof HTMLInputElement) {
      if (elem !== document.activeElement) {
        elem.value = vnode.attrs.value.toFixed(1);
      }
    }
  },
};

const init = async () => {
  const appElem = document.getElementById("app");
  m.mount(appElem!, MainComponent);
};
document.addEventListener("DOMContentLoaded", init);
