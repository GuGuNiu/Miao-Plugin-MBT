import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";

export function Docker(ctx = {}) {
    const { } = ctx;

    let cachedDockerEnv = null;

    function isDockerEnv() {
        if (cachedDockerEnv !== null) return cachedDockerEnv;
        try {
            if (fs.existsSync('/.dockerenv')) {
                cachedDockerEnv = true;
                return true;
            }
            cachedDockerEnv = fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
            return cachedDockerEnv;
        } catch {
            cachedDockerEnv = false;
            return false;
        }
    }

    async function getHostProfile(logger) {
        const Hades = logger || console;
        const platform = os.platform();
        const release = os.release();
        let isDocker = false;
        let dockerenv = false;
        let containerenv = false;
        let cgroup = null;
        let kubernetes = false;
        let containerHint = null;
        const envHint = process.env.CONTAINER || process.env.container;
        const kubeHint = process.env.KUBERNETES_SERVICE_HOST || process.env.KUBERNETES_PORT;
        if (envHint) containerHint = envHint;
        if (kubeHint) kubernetes = true;
        if (platform === 'linux') {
            dockerenv = fs.existsSync('/.dockerenv');
            containerenv = fs.existsSync('/run/.containerenv');
            isDocker = dockerenv || containerenv;
            try {
                const raw = await fsPromises.readFile('/proc/1/cgroup', 'utf-8');
                if (raw) {
                    cgroup = raw.trim().slice(0, 800);
                    const mark = raw.toLowerCase();
                    if (mark.includes('docker') || mark.includes('kubepods') || mark.includes('containerd') || mark.includes('libpod')) {
                        isDocker = true;
                    }
                    if (mark.includes('kubepods') || mark.includes('kube')) kubernetes = true;
                }
            } catch {}
        }
        return {
            platform,
            release,
            isDocker,
            container: {
                dockerenv,
                containerenv,
                cgroup,
                kubernetes,
                hint: containerHint || null
            }
        };
    }

    function applyBrowserArgs(args, opts = {}) {
        if (!Array.isArray(args)) return args;
        if (opts.DSProcess === true) args.push('--single-process');
        return args;
    }

    return { isDockerEnv, getHostProfile, applyBrowserArgs };
}

export default { Docker };