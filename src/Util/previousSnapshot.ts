import { serialize } from '@ayako/utility';

export const SNAPSHOT_WRITE_WINDOW_MS = 30_000;

export interface SnapshotSource<T, R> {
 getTimes: (...ids: string[]) => Promise<number[]>;
 getAt: (time: number, ...ids: string[]) => Promise<R | null>;
 apiToR: (data: T, ...additionalArgs: string[]) => R | false;
}

export interface SnapshotOptions<T, R> {
 cache: SnapshotSource<T, R>;
 ids: string[];
 incoming: T;
 apiArgs?: string[];
 same?: (newest: R, incoming: T) => boolean;
}

export const sortTimesDescending = (times: number[]): number[] => [...times].sort((a, b) => b - a);

const projectionEquals = <T, R>(
 cache: SnapshotSource<T, R>,
 newest: R,
 incoming: T,
 apiArgs: string[],
): boolean | null => {
 const projected = cache.apiToR(incoming, ...apiArgs);
 return projected === false ? null : serialize(newest) === serialize(projected);
};

const writtenByThisDispatch = (time: number): boolean =>
 Date.now() - time <= SNAPSHOT_WRITE_WINDOW_MS;

export const previousSnapshot = async <T, R>(opts: SnapshotOptions<T, R>): Promise<R | null> => {
 const times = sortTimesDescending(await opts.cache.getTimes(...opts.ids));
 if (!times.length) return null;

 const newest = await opts.cache.getAt(times[0], ...opts.ids);
 if (!newest) return null;

 const isIncoming = opts.same
  ? opts.same(newest, opts.incoming)
  : projectionEquals(opts.cache, newest, opts.incoming, opts.apiArgs ?? []);

 if (isIncoming === null) return null;
 if (!isIncoming) return newest;
 if (!writtenByThisDispatch(times[0])) return newest;

 return times.length > 1 ? opts.cache.getAt(times[1], ...opts.ids) : null;
};
