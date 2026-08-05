import { getSystemErrorName } from 'node:util';


export function isSystemError(e: unknown, name: string): e is Error & NodeJS.ErrnoException {
    if (e instanceof Error) {} else return false;
    const maybeSystemError = e as Error & Partial<NodeJS.ErrnoException>;
    if (typeof maybeSystemError.errno === 'number') {} else return false;
    return getSystemErrorName(maybeSystemError.errno) === name;
}

export function isNodeError(e: unknown, code: string): e is Error & NodeJS.ErrnoException {
    if (e instanceof Error) {} else return false;
    const maybeNodeError = e as Error & Partial<NodeJS.ErrnoException>;
    return maybeNodeError.code === code;
}
