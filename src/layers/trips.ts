/**
 * Minimal TripsLayer (WebGL) – a PathLayer that only draws the part of each
 * path behind `currentTime`, fading over `trailLength`. Ported from
 * @deck.gl/geo-layers so the app doesn't pull in that whole package
 * (3D tiles, mesh layers, loaders…) for one layer.
 */
import { PathLayer } from '@deck.gl/layers';

const tripsUniforms = {
  name: 'trips',
  vs: `layout(std140) uniform tripsUniforms {
  bool fadeTrail;
  float trailLength;
  float currentTime;
} trips;
`,
  fs: `layout(std140) uniform tripsUniforms {
  bool fadeTrail;
  float trailLength;
  float currentTime;
} trips;
`,
  uniformTypes: { fadeTrail: 'f32', trailLength: 'f32', currentTime: 'f32' },
} as const;

const inject = {
  'vs:#decl': `in float instanceTimestamps;
in float instanceNextTimestamps;
out float vTime;
`,
  'vs:#main-end': `vTime = instanceTimestamps + (instanceNextTimestamps - instanceTimestamps) * vPathPosition.y / vPathLength;
`,
  'fs:#decl': `in float vTime;
`,
  'fs:DECKGL_FILTER_COLOR': `if(vTime > trips.currentTime || (trips.fadeTrail && (vTime < trips.currentTime - trips.trailLength))) {
  discard;
}
if(trips.fadeTrail) {
  color.a *= 1.0 - (trips.currentTime - vTime) / trips.trailLength;
}
`,
};

class TripsLayerImpl extends (PathLayer as any) {
  static layerName = 'TripsLayer';
  static defaultProps = {
    fadeTrail: true,
    trailLength: { type: 'number', value: 120, min: 0 },
    currentTime: { type: 'number', value: 0, min: 0 },
    getTimestamps: { type: 'accessor', value: (d: any) => d.timestamps },
  };

  getShaders() {
    const shaders = super.getShaders();
    shaders.inject = inject;
    shaders.modules = [...shaders.modules, tripsUniforms];
    return shaders;
  }

  initializeState() {
    super.initializeState();
    this.getAttributeManager().addInstanced({
      timestamps: {
        size: 1,
        accessor: 'getTimestamps',
        shaderAttributes: { instanceTimestamps: { vertexOffset: 0 }, instanceNextTimestamps: { vertexOffset: 1 } },
      },
    });
  }

  draw(params: any) {
    const { fadeTrail, trailLength, currentTime } = this.props;
    this.state.model.shaderInputs.setProps({ trips: { fadeTrail, trailLength, currentTime } });
    super.draw(params);
  }
}

/** Typed as a regular deck.gl layer constructor. */
export const TripsLayer = TripsLayerImpl as unknown as new (props: Record<string, unknown>) => PathLayer;
