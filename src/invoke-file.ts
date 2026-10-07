import { isSystemError } from './error.ts';
import { spawn } from 'node:child_process';
import { kill } from 'node:process';


export async function invokeFileIgnore({
    file,
    args,
    signal,
    cwd,
}: invokeFileIgnore.Params): Promise<number> {
    signal?.throwIfAborted();
    return await new Promise<number>(
        (resolve, reject) => {
            const process = spawn(file, args ?? [], { stdio: 'ignore', detached: true, cwd });

            function killGroup() {
                try {
                    if (process.pid) kill(-process.pid, 'SIGKILL');
                } catch (e) {
                    if (isSystemError(e, 'ESRCH')) {}
                    else throw e;
                }
            }
            signal?.addEventListener('abort', killGroup);

            const errors: Error[] = [];
            process.on('error', e => errors.push(e));
            process.on('close', (code, sig) => {
                signal?.removeEventListener('abort', killGroup);
                if (sig) reject(new AggregateError(errors, sig));
                // Not documented by Node.js v24 official.
                else if (code! < 0) reject(new AggregateError(errors));
                else resolve(code!);
            });
        },
    ).catch(e => Promise.reject(new Error(undefined, { cause: e })));
}
export namespace invokeFileIgnore {
    export interface Params {
        file: string;
        args?: string[],
        signal?: AbortSignal;
        cwd?: string;
    }
}

export async function invokeFile({
    file,
    args,
    signal,
    input,
    cwd,
}: invokeFile.Params): Promise<ExitInfo> {
    signal?.throwIfAborted();
    return await new Promise<ExitInfo>(
        (resolve, reject) => {
            const process = spawn(file, args ?? [], { detached: true, cwd });

            function killGroup() {
                try {
                    if (process.pid) kill(-process.pid, 'SIGKILL');
                } catch (e) {
                    if (isSystemError(e, 'ESRCH')) {}
                    else throw e;
                }
            }
            signal?.addEventListener('abort', killGroup);

            const stdoutBuffers: Buffer[] = [], stderrBuffers: Buffer[] = [];
            process.stdout?.on('data', data => stdoutBuffers.push(data));
            process.stderr?.on('data', data => stderrBuffers.push(data));

            const errors: Error[] = [];
            process.on('error', e => errors.push(e));
            process.on('close', (code, sig) => {
                signal?.removeEventListener('abort', killGroup);
                if (sig) reject(new AggregateError(errors, sig));
                // Not documented by Node.js v24 official.
                else if (code! < 0) reject(new AggregateError(errors))
                else resolve({
                    code: code!,
                    stdout: Buffer.concat(stdoutBuffers).toString(),
                    stderr: Buffer.concat(stderrBuffers).toString(),
                });
            });
            process.stdin?.on('error', () => {});
            process.stdin?.end(input);
        },
    ).catch(e => Promise.reject(new Error(undefined, { cause: e })));
}
export namespace invokeFile {
    export interface Params {
        file: string;
        args?: string[],
        signal?: AbortSignal;
        cwd?: string;
        input?: string;
    }
}

export interface ExitInfo {
    code: number;
    stdout: string;
    stderr: string;
}
