import m from "mithril";

import { Charger, charger } from "./charger";
import version from "./git-version.json";
import { Preset } from "./preset";
import { SelectInput } from "./select";
import { StatusTile } from "./status-tile";
import "./style.css";

(window as any).charger = charger;

const MainComponent: m.Component = {
  view() {
    const status = charger.currentStatus() ?? Charger.emptyStatus();
    const currentPreset = Preset.currentPreset;

    const soc = charger.getStateOfCharge();
    const setpointSOC = charger.getSetpointSoc();
    const asymtoteSOC = charger.getAsymptoteSOC();
    const timeEst = charger.getTimeEstimateSoc(asymtoteSOC);
    const restCellV = charger.getRestCellV() ?? 0;
    const cellCount = charger.getCellCount() ?? 0;
    const capacityAh = charger.getCapacityAh();

    if (!Preset.userPreset.isSet() && soc) {
      //first good charger data
      Preset.userPreset.soc = soc;
      Preset.userPreset.current = charger.setpoint.current;
      Preset.inferPreset();
      console.log("user preset set", Preset.userPreset, "current", Preset.currentPreset);
    }
    const allPresets = Preset.getAllPresets();

    const chargePercentageParts = formatNumber(soc ?? 100, 0, 1).split(".");
    const cRating = capacityAh ? status.dcOutputCurrent / capacityAh : 0;
    const isCharging = status.dcOutputCurrent > 0;
    const isConnected = charger.isConnected();

    let mConnectionOverlay: m.Children;
    if (navigator.bluetooth) {
      if (!isConnected) {
        mConnectionOverlay = m(ConnectButton);
      }
    } else {
      mConnectionOverlay = m(
        "p",
        "Web Bluetooth not available. Try Chrome or ",
        m(
          "a",
          { href: "https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055" },
          "Bluefy"
        )
      );
    }

    return [
      m(".status", [
        // Charge Percentage
        m(".status-soc.status-fullwidth", { className: isConnected ? undefined : "disconnected" }, [
          m(".status-soc-value", [
            chargePercentageParts[0],
            chargePercentageParts.length === 2 && m("span.small", "." + chargePercentageParts[1]),
            m("span.small", "%"),
          ]),
          m(
            ".status-soc-subscript",
            isConnected
              ? isCharging
                ? timeEst
                  ? [Charger.timeStr(timeEst), " until ", formatNumber(asymtoteSOC ?? 0), "%"]
                  : ["Over ", formatNumber(asymtoteSOC ?? 0), "% charged"]
                : "Not charging"
              : "Not connected"
          ),
          mConnectionOverlay && m(".status-soc-overlay", mConnectionOverlay),
        ]),

        // Goal Charge Percentage
        m(StatusTile, {
          editableValue: formatNumber(setpointSOC ?? 0),
          displayValue: formatNumber(setpointSOC ?? 0) + "%",
          subscript: formatNumber(currentPreset.getOutputVoltage(cellCount), 0, 1) + "V",
          onChange: (valueStr) => {
            const value = Number(valueStr);
            if (!isFinite(value)) return;
            // TODO: This sets the charger voltage via Preset.. Too much
            // indirection here. I think we should move away from the singleton
            // pattern.
            Preset.userPreset.setSoc(value);
          },
        }),

        // Output Current
        m(StatusTile, {
          editableValue: formatNumber(currentPreset.getCurrent()),
          displayValue: isCharging
            ? formatNumber(status.dcOutputCurrent, 0, 1) + "A"
            : formatNumber(currentPreset.getCurrent()) + "A",
          subscript: formatNumber(status.dcOutputVoltage * status.dcOutputCurrent, 0, 0) + "W",
          onChange: (valueStr) => {
            const value = Number(valueStr);
            if (!isFinite(value)) return;
            Preset.userPreset.setCurrent(value);
          },
        }),

        // C Rating
        m(StatusTile, {
          displayValue: formatNumber(cRating) + "C",
          subscript: "C-rating of " + (capacityAh ?? 0).toFixed(1) + "Ah",
        }),

        // Resting Cell Voltage
        m(StatusTile, {
          displayValue: formatNumber(restCellV) + "V",
          subscript: "rest v/cell " + cellCount + "S",
        }),

        // Temperature
        m(StatusTile, {
          displayValue: Math.max(status.temperature1, status.temperature2).toFixed(0) + "°c",
          subscript: [
            "AC ",
            formatNumber(status.acInputVoltage, 0, 1),
            "V ",
            formatNumber(status.acInputCurrent, 0, 1),
            "A ",
            formatNumber(status.acInputVoltage * status.acInputCurrent, 0, 0),
            "W",
          ],
        }),

        // Resting Pack Voltage
        m(StatusTile, {
          displayValue: formatNumber(restCellV * cellCount, 0, 1) + "V",
          subscript: "@ rest",
        }),

        m(".status-fullwidth", [
          m(".input-group", [
            m("label", "Preset"),
            m(SelectInput, {
              options: allPresets.map((m) => m.getDesc()),
              selected: Preset.currentPreset ? Preset.currentPreset.getDesc() : undefined,
              onChange: (index: number) => {
                if (index < 0) return;
                Preset.currentPreset = allPresets[index];
                Preset.currentPreset.sendOutput();
              },
            }),
          ]),
        ]),
        m(".status-fullwidth", [
          m(".input-group", [
            m("label", "Model" + (charger.autoDetectedModel ? " (detected)" : "")),
            m(SelectInput, {
              options: charger.modelsDB.models.map((m) => m.name),
              selected: charger.model?.name,
              onChange: (index: number) => {
                charger.model = index >= 0 ? charger.modelsDB.models[index] : undefined;
                charger.autoDetectedModel = false;
                Preset.currentPreset?.sendOutput();
              },
            }),
          ]),
        ]),

        isConnected && m(".status-fullwidth", m(ConnectButton)),
      ]),
      m("footer", [
        m("p", "Open source on ", m("a", { href: "http://github.com/notlion/v4sc-app" }, "github")),
        m(".sub", "Version ", version),
      ]),
    ];
  },
};

const ConnectButton: m.Component = {
  view() {
    return m(
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
    );
  },
};

const formatNumber = (num: number, minFractionDigits = 0, maxFractionDigits = 2) => {
  let str = num.toFixed(maxFractionDigits);

  // Integers can skip the next part.
  if (maxFractionDigits === 0) return str;

  // Remove and add zeros so that `minFractionDigits` and `maxFractionDigits`
  // are satisfied.
  str = str.replace(/0*$/, "");
  const decimalIndex = str.lastIndexOf(".");
  const fractionDigits = str.length - decimalIndex - 1;
  if (fractionDigits < minFractionDigits) {
    str = str + new Array(minFractionDigits).fill("0").join("");
  }
  if (str[str.length - 1] === ".") {
    return str.slice(0, str.length - 1);
  }
  return str;
};

const init = async () => {
  const appElem = document.getElementById("app");
  m.mount(appElem!, MainComponent);
};
document.addEventListener("DOMContentLoaded", init);
