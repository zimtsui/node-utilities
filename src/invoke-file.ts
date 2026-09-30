import { isSystemError } from './error.ts';
import { spawn } from 'node:child_process';
import { kill } from 'node:process';


/**
 * @throws `signal.reason` if aborted by the signal.
 */
export async function invokeFileIgnore(
    file: string,
    args: string[] = [],
    signal?: AbortSignal,
): Promise<number> {
    signal?.throwIfAborted();
    return await new Promise<number>(
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
            signal?.addEventListener('abort', killProcess);

            const errors: Error[] = [];
            process.on('error', e => errors.push(e));
            process.on('close', (exitCode, systemSignal) => {
                signal?.removeEventListener('abort', killProcess);
                if (systemSignal) reject(new Error(systemSignal, { cause: errors }));
                // Not documented by Node.js v24 official.
                else if (exitCode! < 0) reject(new Error(undefined, { cause: errors }));
                else resolve(exitCode!);
            });
        },
    ).catch(e => Promise.reject(signal?.aborted ? signal.reason : new Error(undefined, { cause: e })));
}

/**
 * @throws `signal.reason` if aborted by the signal.
 */
export async function invokeFile(
    file: string,
    args: string[] = [],
    signal?: AbortSignal,
    input: string = '',
): Promise<ExitInfo> {
    signal?.throwIfAborted();
    return await new Promise<ExitInfo>(
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
            signal?.addEventListener('abort', killProcess);

            const stdoutBuffers: Buffer[] = [], stderrBuffers: Buffer[] = [];
            process.stdout?.on('data', data => stdoutBuffers.push(data));
            process.stderr?.on('data', data => stderrBuffers.push(data));

            const errors: Error[] = [];
            process.on('error', e => errors.push(e));
            process.on('close', (exitCode, systemSignal) => {
                signal?.removeEventListener('abort', killProcess);
                if (systemSignal) reject(new Error(systemSignal, { cause: errors }));
                // Not documented by Node.js v24 official.
                else if (exitCode! < 0) reject(new Error(undefined, { cause: errors }))
                else resolve({
                    code: exitCode!,
                    stdout: Buffer.concat(stdoutBuffers).toString(),
                    stderr: Buffer.concat(stderrBuffers).toString(),
                });
            });
            process.stdin?.on('error', () => {});
            process.stdin?.end(input);
        },
    ).catch(e => Promise.reject(signal?.aborted ? signal.reason : new Error(undefined, { cause: e })));
}

export interface ExitInfo {
    code: number;
    stdout: string;
    stderr: string;
}
