import { Config, materials, noises } from "./configscheme";

export const config: Config = {
  settings: {
    sourceResolution: 0.1,
  },
  room: {
    sources: [
      {
        position: [-3.6, 1.4, 6.5],
        volume: noises.music_techno,
        spreadAngle: 120,
        direction: [1, 0, -0.4],
      },
      {
        position: [-3.6, 1.5, 4.5],
        volume: noises.music_techno,
        spreadAngle: 120,
        direction: [1, 0, 0.4],
      },
    ],
    walls: [
      {
        soundReflexionFac: materials.wallpaper.soundReflexionFac,
        vertices: [
          [0, 0, 0],
          [-5.28, 0, 0],
          [-5.28, 2.44, 0],
          [0, 2.44, 0],
          [0, 0, 0],
        ],
      },
      {
        soundReflexionFac: materials.wallpaper.soundReflexionFac,
        vertices: [
          [-5.28, 0, 0],
          [-5.28, 0, 1.85],
          [-5.28, 2.44, 1.85],
          [-5.28, 2.44, 0],
          [-5.28, 0, 0],
        ],
      },
      {
        soundReflexionFac: materials.wallpaper.soundReflexionFac,
        vertices: [
          [-5.28, 0, 2.75],
          [-5.28, 0, 3.78],
          [-5.28, 2.44, 3.78],
          [-5.28, 2.44, 2.75],
          [-5.28, 0, 2.75],
        ],
      },
      {
        soundReflexionFac: materials.wallpaper.soundReflexionFac,
        vertices: [
          [-5.28, 2.05, 1.85],
          [-5.28, 2.05, 2.75],
          [-5.28, 2.44, 2.75],
          [-5.28, 2.44, 1.85],
          [-5.28, 2.05, 1.85],
        ],
      },
      {
        soundReflexionFac: materials.wallpaper.soundReflexionFac,
        vertices: [
          [-5.28, 0, 3.78],
          [-3.87, 0, 3.78],
          [-3.87, 2.44, 3.78],
          [-5.28, 2.44, 3.78],
          [-5.28, 0, 3.78],
        ],
      },
      {
        soundReflexionFac: materials.wallpaper.soundReflexionFac,
        vertices: [
          [-3.87, 0, 3.78],
          [-3.87, 0, 7.96],
          [-3.87, 2.44, 7.96],
          [-3.87, 2.44, 3.78],
          [-3.87, 0, 3.78],
        ],
      },
      {
        soundReflexionFac: materials.wallpaper.soundReflexionFac,
        vertices: [
          [-3.87, 0, 7.96],
          [0, 0, 7.96],
          [0, 2.44, 7.96],
          [-3.87, 2.44, 7.96],
          [-3.87, 0, 7.96],
        ],
      },
      {
        soundReflexionFac: materials.wallpaper.soundReflexionFac,
        vertices: [
          [0, 0, 7.96],
          [0, 0, 0],
          [0, 2.44, 0],
          [0, 2.44, 7.96],
          [0, 0, 7.96],
        ],
      },
      {
        soundReflexionFac: materials.wallpaper.soundReflexionFac,
        vertices: [
          [0, 2.44, 0],
          [-5.28, 2.44, 0],
          [-5.28, 2.44, 3.78],
          [-3.87, 2.44, 3.78],
          [-3.87, 2.44, 7.96],
          [0, 2.44, 7.96],
          [0, 2.44, 0],
        ],
      },
      {
        soundReflexionFac: materials.parquet.soundReflexionFac,
        vertices: [
          [0, 0, 0],
          [-5.28, 0, 0],
          [-5.28, 0, 3.78],
          [-3.87, 0, 3.78],
          [-3.87, 0, 7.96],
          [0, 0, 7.96],
          [0, 0, 0],
        ],
      },
    ],
  },
};
