import { actionIconImages } from '../actionIcons';
import { actions } from '../catalog';

it('bundles an image for every action in the catalogue', () => {
  expect(Object.keys(actionIconImages).sort()).toEqual(actions.map(action => action.id).sort());
  for (const action of actions) expect(actionIconImages[action.id]).toBeDefined();
});
