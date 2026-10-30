import { afterEach, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { PlayerController } from '../../src/scene/PlayerController';
import { StudentModel } from '../../src/scene/StudentModel';

import { ElementDouble } from './controller-harness';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('disposes a model that resolves after its controller was disposed, without attaching it', async () => {
  const doc = Object.assign(new EventTarget(), { createElement: () => new ElementDouble() });
  vi.stubGlobal('document', doc); vi.stubGlobal('window', new EventTarget());
  let finish!: (model: StudentModel) => void;
  vi.spyOn(StudentModel, 'load').mockReturnValue(new Promise<StudentModel>(resolve => { finish = resolve; }));
  const fake = { root: new Group(), dispose: vi.fn(), update: vi.fn() } as unknown as StudentModel;
  const canvas = new ElementDouble();
  const controller = new PlayerController(new ElementDouble() as unknown as HTMLElement, canvas as unknown as HTMLCanvasElement);
  expect(canvas.dataset.playerModel).toBe('loading');
  controller.dispose(); finish(fake); await Promise.resolve(); await Promise.resolve();
  expect(fake.dispose).toHaveBeenCalledOnce();
  expect(controller.avatar.children).not.toContain(fake.root);
  expect(canvas.dataset.playerModel).toBe('loading');
});
