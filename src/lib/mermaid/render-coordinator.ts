export type RenderOutcome<TResult> =
  | { status: 'rendered'; requestId: number; result: TResult }
  | { status: 'superseded'; requestId: number };

type PendingRequest<TOptions, TResult> = {
  requestId: number;
  source: string;
  options: TOptions;
  resolve: (outcome: RenderOutcome<TResult>) => void;
  reject: (error: unknown) => void;
};

export class LatestWinsRenderCoordinator<TOptions, TResult> {
  private active = false;
  private nextRequestId = 0;
  private pending: PendingRequest<TOptions, TResult> | undefined;

  constructor(private readonly render: (source: string, options: TOptions) => Promise<TResult>) {}

  enqueue(source: string, options: TOptions): Promise<RenderOutcome<TResult>> {
    const requestId = this.nextRequestId += 1;

    return new Promise<RenderOutcome<TResult>>((resolve, reject) => {
      if (this.pending) {
        this.pending.resolve({ status: 'superseded', requestId: this.pending.requestId });
      }

      this.pending = { requestId, source, options, resolve, reject };
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.active) return;
    this.active = true;

    try {
      while (this.pending) {
        const request = this.pending;
        this.pending = undefined;

        try {
          const result = await this.render(request.source, request.options);
          if (request.requestId !== this.nextRequestId) {
            request.resolve({ status: 'superseded', requestId: request.requestId });
          } else {
            request.resolve({ status: 'rendered', requestId: request.requestId, result });
          }
        } catch (error) {
          if (request.requestId !== this.nextRequestId) {
            request.resolve({ status: 'superseded', requestId: request.requestId });
          } else {
            request.reject(error);
          }
        }
      }
    } finally {
      this.active = false;
    }
  }
}
