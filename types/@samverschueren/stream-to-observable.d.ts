/// <reference types="node" />

import { Observable } from "rxjs";

interface Options {
  /**
   * If provided, the Observable will not "complete" until await is resolved.
   * If await is rejected, the Observable will immediately emit an error event and disconnect from the stream.
   * This is mostly useful when attaching to the stdin or stdout streams of a child_process.
   * Those streams usually do not emit error events, even if the underlying process exits with an error.
   * This provides a means to reject the Observable if the child process exits with an unexpected error code.
   */
  await?: Promise<any>;

  /**
   * Default: `"end"`.
   * If you are using an EventEmitter or non-standard Stream, you can change which event signals that the Observable should be completed.
   * Setting this to false will avoid listening for any end events.
   * Setting this to false and providing an await Promise will cause the Observable to resolve immediately with the await Promise (the Observable will remove all it's data event listeners from the stream once the Promise is resolved).
   */
  endEvent?: string | false;

  /**
   * Default: `"error"`.
   * If you are using an EventEmitter or non-standard Stream, you can change which event signals that the Observable should be closed with an error.
   * Setting this to false will avoid listening for any error events.
   */
  errorEvent?: string | false;

  /**
   * Default: `"data"`.
   * If you are using an EventEmitter or non-standard Stream, you can change which event causes data to be emitted to the Observable.
   */
  dataEvent?: string;
}

/**
 * Convert Node Streams into ECMAScript-Observables.
 *
 * @param stream stream can technically be any `EventEmitter` instance.
 * By default, this module listens to the standard Stream events (`data`, `error`, and `end`),
 * but those are configurable via the `options` parameter.
 * If you are using this with a standard Stream, you likely won't need the `options` parameter.
 * @param options
 */
declare function streamToObservable(
  stream: NodeJS.ReadableStream,
  options?: Options
): Observable<any>;

export = streamToObservable;
