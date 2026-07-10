export function Protocol(ctx = {}) {
    const { DockerMod } = ctx;

    function isOneBotFamily(e) {
        if (!e) return false;
        const adapterName = e?.bot?.adapter?.name || '';
        if (adapterName.includes('OneBot')) return true;
        const selfId = String(e?.self_id || '');
        if (selfId.startsWith('2900')) return true;
        return false;
    }

    function isOneBot() {
        try {
            return typeof Bot?.adapter?.name === 'string' && Bot.adapter.name.includes('OneBot');
        } catch { return false; }
    }

    function isDocker() {
        return DockerMod?.isDockerEnv?.() ?? false;
    }

    function isOneBotDocker() {
        return isOneBot() && isDocker();
    }

    function adaptImgType(requested = 'png') {
        if (requested !== 'png') return requested;
        if (!isOneBotDocker()) return 'png';
        return 'webp';
    }

    return { isOneBotFamily, isOneBot, isDocker, isOneBotDocker, adaptImgType };
}

export default { Protocol };