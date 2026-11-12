importScripts('cast-model.js');
onmessage = ({data}) => {
  const result = CastModel.simulate(data.settings);
  postMessage({key:data.key,result}, result.frames.map(frame => frame.points.buffer));
};
