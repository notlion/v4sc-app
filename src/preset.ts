import { Charger, charger } from "./charger";


export class Preset {
  name: string;
  soc: number;
  current: number;
  constructor(name: string, soc: number, current: number) {
    this.name = name;
    this.soc = soc;
    this.current = current;
  }

  static userPreset: Preset = new Preset("Custom", 0, 0);
  static currentPreset: Preset = Preset.userPreset;

  isSet() {
    return this.soc !== 0 && this.current !== 0;
  }
  getCurrent() {
    return this.current != Infinity ? this.current : charger.model?.maxcurrent ?? 0;
  }
  getDesc() {
    const cellCount = charger.getCellCount() ?? 1;
    if (this.soc === 0 || this.current === 0) return this.name;
    return [
      this.name,
      this.getCurrent().toFixed(0) + "A",
      this.soc.toFixed(0) + "%",
      (Charger.getVoltageForSoc(this.soc) * cellCount).toFixed(1) + "V",
    ].join(" ");
  }
  getOutputVoltage(cellCount: number) {
    return Charger.getVoltageForSoc(this.soc) * cellCount;
  }
  sendOutputVoltage() {
    charger.setOutputVoltage(this.getOutputVoltage(charger.getCellCount() ?? 0));
  }
  sendOutputCurrent() {
    charger.setOutputCurrent(this.current);
  }
  sendOutput() {
    if (this.soc === 0 || this.current === 0) {
      charger.setOutputEnabled(false);
    } else {
      if (!charger.isOutputEnabled()) charger.setOutputEnabled(true);
      this.sendOutputVoltage();
      this.sendOutputCurrent();
    }
  }
  setSoc(newsoc: number) {
    this.soc = newsoc;
    this.sendOutputVoltage();
    Preset.inferPreset();
  }
  setVoltage(newvoltage: number) {
    if (newvoltage > 5) newvoltage = newvoltage / (charger.getCellCount() ?? 1);
    this.soc = Charger.getSOCFromVoltage(newvoltage);
    this.sendOutputVoltage();
    Preset.inferPreset();
  }
  setCurrent(newcurrent: number) {
    this.current = newcurrent;
    this.sendOutputCurrent();
    Preset.inferPreset();
  }
  static inferPreset() {
    const soc = charger.getSetpointSoc() ?? 0;
    for (const p of presets) {
      // now find a preset that matches
      if (Math.abs(p.soc - soc) < 1 && Math.abs(p.current - charger.setpoint.current) < 0.3) {
        Preset.currentPreset = p;
        return;
      }
    }
    Preset.currentPreset = Preset.userPreset; //fallback
  }

  static getAllPresets() {
    return Preset.userPreset && Preset.userPreset.isSet()
      ? [...presets, Preset.userPreset]
      : presets;
  }
}

export const presets: Preset[] = [
  new Preset("Off", 0, 0),
  new Preset("Max", 100, Infinity),
  new Preset("Casual", 90, 5),
  new Preset("Storage", 60, 3),
];

Object.freeze(presets);
