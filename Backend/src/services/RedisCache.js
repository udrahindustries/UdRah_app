/**
 * High-Performance Resilient Redis Caching Service.
 * Provides Fast Geospatial Key-Value Caching With Automatic In-Memory Fallback.
 * Strictly Adheres To Antigravity Coding Standards (Title Case Logs & Comments).
 */

const Redis = require('ioredis');

class RedisCacheManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.memoryCache = new Map();
    this.memoryTimers = new Map();

    this.InitializeClient();
  }

  InitializeClient() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        enableOfflineQueue: false,
        connectTimeout: 1000,
        retryStrategy: () => null,
      });

      this.client.connect().then(() => {
        this.isConnected = true;
        console.log('[Redis Cache] Redis Service Connected Successfully');
      }).catch(() => {
        this.isConnected = false;
        console.log('[Redis Cache] Redis Server Unavailable. Active In-Memory Cache Engaged.');
      });

      this.client.on('error', () => {
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (err) {
      this.isConnected = false;
      console.log('[Redis Cache] Redis Initialization Bypassed. In-Memory Cache Active.');
    }
  }

  async Get(key) {
    if (this.isConnected && this.client) {
      try {
        const val = await this.client.get(key);
        return val ? JSON.parse(val) : null;
      } catch (e) {
        // Fallback To Local Memory Store
      }
    }

    return this.memoryCache.get(key) || null;
  }

  async Set(key, value, ttlSeconds = 300) {
    const serialized = JSON.stringify(value);

    if (this.isConnected && this.client) {
      try {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
        return;
      } catch (e) {
        // Fallback To Local Memory Store
      }
    }

    // Local Memory Cache Fallback
    this.memoryCache.set(key, value);

    if (this.memoryTimers.has(key)) {
      clearTimeout(this.memoryTimers.get(key));
    }

    const timer = setTimeout(() => {
      this.memoryCache.delete(key);
      this.memoryTimers.delete(key);
    }, ttlSeconds * 1000);

    this.memoryTimers.set(key, timer);
  }

  async Del(key) {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch (e) {}
    }
    this.memoryCache.delete(key);
    if (this.memoryTimers.has(key)) {
      clearTimeout(this.memoryTimers.get(key));
      this.memoryTimers.delete(key);
    }
  }
}

const RedisCache = new RedisCacheManager();

module.exports = { RedisCache };
