class CommunityTaskError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "CommunityTaskError";
    this.code = code;
  }
}

class CommunityTaskQueue {
  constructor(name, mutex, logger, options = {}, getHades = null, Pheme = null) {
    this.name = name;
    this._mutex = mutex;
    this.Hades = getHades ? getHades(logger) : logger;
    this._Pheme = Pheme;
    this._cooldownMs = options.cooldownMs ?? 300000;
    this._maxQueueSize = options.maxQueueSize ?? 5;
    this._lastReleaseTime = 0;
    this._pendingCount = 0;
    this._totalProcessed = 0;
  }

  async run(taskFn, options = {}) {
    const {
      id = "Unknown",
      ttl = 0,
      priority = 10,
      skipCooldown = false,
      taskLabel = id,
      e = null
    } = options;

    const notify = async (msg) => {
      if (e && this._Pheme) {
        try { await this._Pheme.quote(e, msg); } catch {}
      }
    };

    if (this._pendingCount >= this._maxQueueSize) {
      throw new CommunityTaskError(
        `队列已满 (${this._maxQueueSize})，请稍后重试`,
        "Queue_Full"
      );
    }

    const stats = this._mutex.getStats();
    const wasBusy = stats.locked;
    if (wasBusy) {
      this._pendingCount++;
      const queuePos = this._pendingCount;
      const elapsedMin = Math.floor(stats.uptime / 60000);
      await notify(
        `⏳ 任务 [${taskLabel}] 已排队（第 ${queuePos} 位）\n` +
        `当前任务已运行 ${elapsedMin} 分钟\n` +
        `排队任务完成后将自动执行，无需重复发送指令。`
      );
    }

    try {
      await this._mutex._acquire(id, 0, false, priority);
    } catch (err) {
      if (wasBusy) this._pendingCount--;
      throw err;
    }

    if (wasBusy) this._pendingCount--;

    if (this._mutex._holder) {
      this._mutex._holder.start = performance.now();
    }

    if (!skipCooldown && this._lastReleaseTime > 0) {
      const cooldownRemaining =
        this._cooldownMs - (performance.now() - this._lastReleaseTime);
      if (cooldownRemaining > 0) {
        const cooldownSec = Math.ceil(cooldownRemaining / 1000);
        this.Hades.O(`[${this.name}] 冷却等待 ${cooldownSec}s`);
        await notify(`任务 [${taskLabel}] 进入冷却等待（${cooldownSec}s）...`);
        await new Promise((r) => setTimeout(r, cooldownRemaining));
      }
    }

    const controller = new AbortController();
    let timeoutTimer = null;
    if (ttl > 0) {
      timeoutTimer = setTimeout(() => {
        controller.abort("TTL_Expired");
        if (this._mutex._holder) this._mutex._holder.expired = true;
      }, ttl);
    }

    let suspended = false;
    const ctx = {
      suspend: async (reason = "manual") => {
        if (suspended) return;
        suspended = true;
        this.Hades.O(`[${this.name}] 任务 [${id}] 挂起: ${reason}`);
        this._mutex._release(id);
        await notify(`💤 任务 [${taskLabel}] 已挂起（${reason}）`);
      },
      resume: async () => {
        if (!suspended) return;
        suspended = false;
        await this._mutex._acquire(id, 0, false, priority);
        if (this._mutex._holder) {
          this._mutex._holder.start = performance.now();
        }
        this.Hades.O(`[${this.name}] 任务 [${id}] 恢复执行`);
      }
    };

    try {
      this.Hades.O(`[${this.name}] 任务 [${id}] 开始执行`);
      return await taskFn(controller.signal, ctx);
    } catch (err) {
      if (controller.signal.aborted && controller.signal.reason === "TTL_Expired") {
        throw new CommunityTaskError(`任务超过TTL (${ttl}ms)`, "TTL_Expired");
      }
      throw err;
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      this._mutex._release(id);
      if (!skipCooldown && !suspended) {
        this._lastReleaseTime = performance.now();
      }
      this._totalProcessed++;
      this.Hades.O(`[${this.name}] 任务 [${id}] 完成`);
    }
  }

  getStats() {
    const metaStats = this._mutex.getStats();
    const cooldownRemaining =
      this._lastReleaseTime > 0
        ? Math.max(0, this._cooldownMs - (performance.now() - this._lastReleaseTime))
        : 0;
    return {
      ...metaStats,
      pendingCount: this._pendingCount,
      totalProcessed: this._totalProcessed,
      cooldownRemainingMs: cooldownRemaining,
      cooldownActive: cooldownRemaining > 0
    };
  }

  emergencyReset(reason) {
    this._mutex.emergencyReset(reason);
    this._pendingCount = 0;
    this._lastReleaseTime = 0;
  }
}

export { CommunityTaskQueue, CommunityTaskError };
export default CommunityTaskQueue;