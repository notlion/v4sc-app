
export class WheelModel {
  name: string;
  seriescells: number = 0;
  capacityWh: number = 0;
  maxcurrent: number = 0;
  totalOhms: number = 0;
  constructor(name: string, cellS: number, Wh: number, maxA: number, totalOhms: number = 0.022 / 4) {
    this.name = name;
    this.seriescells = cellS;
    this.maxcurrent = maxA;
    this.capacityWh = Wh;
    this.totalOhms = totalOhms;
  }
}

export class ModelsDB {
  models: WheelModel[];

  constructor() {
    this.models = [
      //----------------------------    S    Wh   A   Ohm
      new WheelModel("KingSong S22",   30, 2220, 12, 0.022 / 4 * 30),
      new WheelModel("Inmotion V13",   30, 3024, 14, 0.035 / 8 * 30), //35E, 8p
      new WheelModel("Begode Master",  32, 2400, 10, 0.022 / 4 * 32),
      new WheelModel("Leaperkim Lynx", 36, 2600, 18, 0.022 / 4 * 36), //50S, 4p
      new WheelModel("Begode ET Max",  40, 3000, 20, 0.022 / 4 * 40), //50S, 4p
    ];
    console.log("WheelModel", this.models);
  }

  detectModel(setV: number, atV: number) {
    for (const model of this.models) {
      const maxTargetV = model.seriescells * 4.24;
      if (setV >= maxTargetV) continue;
      const minTargetV = model.seriescells * 3.0;
      if (atV < minTargetV) continue;
      console.log("Cell count estimated", model.seriescells);
      return model;
    }
    return;
  }
}

