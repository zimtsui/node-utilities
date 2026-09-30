import { isSystemError } from './error.ts';
import { spawn } from 'node:child_process';
import { kill } from 'node:process';


export function invokeFileIgnore(
    file: string,
    args: string[] = [],
    maybeSignals: (AbortSignal | undefined | null)[] = [],
): Promise<number> {
    const abortSignals = maybeSignals.filter(maybeSignal => !!maybeSignal);
    const abortSignal = abortSignals.length ? AbortSignal.any(abortSignals) : undefined;
    abortSignal?.throwIfAborted();
    return new Promise(
        (resolve, reject) => {
            const process = spawn(file, args, { stdio: 'ignore', detached: true });

            function killProcess() {
                try {
                    if (process.pid) kill(-process.pid, 'SIGKILL');
                } catch (e) {
                    if (isSystemError(e, 'ESRCH')) {}
                    else throw e;
                }
            }
            abortSignal?.addEventListener('abort', killProcess);

            let error: Error | null = null;
            process.on('error', e => error = e);
            process.on('close', (code, signal) => {
                abortSignal?.removeEventListener('abort', killProcess);
                if (error) reject(new Error(undefined, { cause: error }));
                else if (signal) reject(new Error(signal));
                else resolve(code!);
            });
        },
    );
}

export function invokeFile(
    file: string,
    args: string[] = [],
    maybeSignals: (AbortSignal | undefined | null)[] = [],
    input: string = '',
): Promise<ExitInfo> {
    const abortSignals = maybeSignals.filter(maybeSignal => !!maybeSignal);
    const abortSignal = abortSignals.length ? AbortSignal.any(abortSignals) : undefined;
    abortSignal?.throwIfAborted();
    return new Promise(
        (resolve, reject) => {
            const process = spawn(file, args, { detached: true });

            function killProcess() {
                try {
                    if (process.pid) kill(-process.pid, 'SIGKILL');
                } catch (e) {
                    if (isSystemError(e, 'ESRCH')) {}
                    else throw e;
                }
            }
            abortSignal?.addEventListener('abort', killProcess);

            const stdoutBuffers: Buffer[] = [], stderrBuffers: Buffer[] = [];
            process.stdout?.on('data', data => stdoutBuffers.push(data));
            process.stderr?.on('data', data => stderrBuffers.push(data));

            let error: Error | null = null;
            process.on('error', e => error = e);
            process.on('close', (code, signal) => {
                abortSignal?.removeEventListener('abort', killProcess);
                if (error) reject(new Error(undefined, { cause: error }));
                else if (signal) reject(new Error(signal));
                else resolve({
                    code: code!,
                    stdout: Buffer.concat(stdoutBuffers).toString(),
                    stderr: Buffer.concat(stderrBuffers).toString(),
                });
            });
            process.stdin?.on('error', () => {});
            process.stdin?.end(input);
        },
    );

}

export interface ExitInfo {
    code: number;
    stdout: string;
    stderr: string;
}
