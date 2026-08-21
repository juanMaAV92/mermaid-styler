import { describe, expect, it } from 'vitest';
import { LatestWinsRenderCoordinator } from '../../src/lib/mermaid/render-coordinator';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

describe('LatestWinsRenderCoordinator', () => {
  it('keeps one active render and supersedes pending and stale results', async () => {
    const firstRender = deferred<string>();
    const calls: string[] = [];
    const coordinator = new LatestWinsRenderCoordinator<Record<string, never>, string>(async (source) => {
      calls.push(source);
      if (source === 'first') return firstRender.promise;
      return source.toUpperCase();
    });

    const first = coordinator.enqueue('first', {});
    const second = coordinator.enqueue('second', {});
    const third = coordinator.enqueue('third', {});

    await expect(second).resolves.toEqual({ status: 'superseded', requestId: 2 });
    firstRender.resolve('FIRST');

    await expect(first).resolves.toEqual({ status: 'superseded', requestId: 1 });
    await expect(third).resolves.toEqual({ status: 'rendered', requestId: 3, result: 'THIRD' });
    expect(calls).toEqual(['first', 'third']);
  });
});
