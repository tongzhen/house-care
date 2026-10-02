import { render } from '@testing-library/react-native';
import { ActionIcon, actionIconIds } from '../actionIcons';
import { actions } from '../catalog';

describe('action icons', () => {
  it('has one vector icon for every catalogue action', async () => {
    expect([...actionIconIds].sort()).toEqual(actions.map((action) => action.id).sort());
    for (const actionId of actionIconIds) {
      const view = await render(<ActionIcon actionId={actionId} />);
      expect(view.getByTestId(`action-icon-${actionId}`)).toBeTruthy();
      await view.unmount();
    }
  });
});
