import m from "mithril";

import { SelectInput } from "./select";
import { Charger, charger } from "./charger";
import { Preset } from "./preset";
import "./style.css";
import vers from "./git-version.json";

(window as any).charger = charger;

function vChange(e: InputEvent, setter: (value: number) => void) {
  const target = e.target as HTMLDivElement;
  const value = parseFloat(target.textContent?.replace(/[^0-9.]/g, "") ?? "0");
  console.log("value changed", target.textContent, value);
  setter(value);
}

const MainComponent: m.Component = {
  view() {
    const s = charger.currentStatus() ?? Charger.emptyStatus();
    const soc = charger.getStateOfCharge();
    const goalSOC = charger.getSetpointSoc();
    const goalSOCShow = (!goalSOC || goalSOC > 90)? 90 : goalSOC;
    const timeEst = charger.getTimeEstimateSoc(goalSOCShow);
    const restCellV = charger.getRestCellV() ?? 0;
    const cellCount = charger.getCellCount() ?? 0;
    const capacityAh = charger.getCapacityAh();
    const socStr = ((soc? soc.toFixed(1) : "NA.0") + "%").split(".");
    if (!Preset.userPreset.isSet() && soc) { //first good charger data
      Preset.userPreset.soc = soc;
      Preset.userPreset.current = charger.setpoint.current;
      Preset.inferPreset();
      console.log("user preset set", Preset.userPreset, "current", Preset.currentPreset);
    }
    const allPresets = Preset.getAllPresets();
    console.log("render selected", Preset.currentPreset);
    return [
      m(".status", [
        m("h2", [
          m(".val", [socStr[0], m("span.small", "." + socStr[1]) ]),
        ]),
        m("h3", [
          m(".val", (timeEst? Charger.timeStr(timeEst) : "∞")),
          m(".sub", ["until " + goalSOCShow.toFixed(0) + "%"]),
        ]),
        m("h4", [
          m(".val", { contenteditable: "true", onblur: (e: InputEvent) => vChange(e, (v) => Preset.userPreset.setCurrent(v)) },
            m.trust(s.dcOutputCurrent.toFixed(1) + "A")),
          m(".val .sub", (s.dcOutputVoltage * s.dcOutputCurrent).toFixed(1) + "W"),
        ]),
        m("h4", [ //c-rating
          m(".val", capacityAh? (s.dcOutputCurrent / capacityAh).toFixed(1) + "C" : "0C"),
          m(".sub", "c-rating of " + (capacityAh ?? 0).toFixed(1) + "Ah"),
        ]),
        m("h4", [
          //bind to the blur and return press events
          m(".val", { contenteditable: "true", onblur: (e: InputEvent) => vChange(e, (v) => Preset.userPreset.setSoc(v)) },
            m.trust((goalSOC ?? 0).toFixed(0) + "%")),
          m(".sub", ["setpoint ",
            m("span", { contenteditable: "true", onblur: (e: InputEvent) => vChange(e, (v) => Preset.userPreset.setVoltage(v)) },
              m.trust(charger.setpoint.voltage.toFixed(1) + "V "))]),
        ]),
        m("h4", [
          m(".val", restCellV.toFixed(2) + "V"),
          m(".val .sub", "rest v/cell " + cellCount + "S"),
        ]),
        m("h4", [ //charger temp / AC status
          m(".val", (Math.max(s.temperature1, s.temperature2)).toFixed(0) + "ºC"),
          m(".val .sub", ("AC " + s.acInputVoltage.toFixed(0) + "V " + s.acInputCurrent.toFixed(1) + "A")),
          // also could add s.acInputFrequency
        ]),
        m("h4", [
          m(".val", (restCellV * cellCount).toFixed(1) + "V"),
          m(".val .sub", "@ rest "),
        ]),
      ]),
      m(".input-group", [
        m("label", "Presets"),
          m(SelectInput, {
            className: "model-select",
            options: allPresets.map((m) => m.getDesc()),
            selected: Preset.currentPreset?.getDesc(),
            onChange: (index: number) => {
              Preset.currentPreset = (index >= 0)? allPresets[index] : undefined;
              Preset.currentPreset?.sendOutput();
            },
          }),
      ]),
      m(".input-group", [
        m("label", "Model" + (charger.autoDetectedModel? " (detected)" : "")),
          m(SelectInput, {
            className: "model-select",
            options: charger.modelsDB.models.map((m) => m.name),
            selected: charger.model?.name,
            onChange: (index: number) => {
              charger.model = (index >= 0)? charger.modelsDB.models[index] : undefined;
              charger.autoDetectedModel = false;
              Preset.currentPreset?.sendOutput();
            },
          }),
      ]),
      m("button.connect",
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

const init = async () => {
  const appElem = document.getElementById("app");
  m.mount(appElem!, MainComponent);
};
document.addEventListener("DOMContentLoaded", init);
