'use strict';

/**
 * 项目脚手架
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

const fs = require('fs');
const path = require('path');
const bunyan = require('bunyan');
const ProjectCore = require('project-core');
const createNamespace = require('lei-ns').create;

// 根据逗号分隔字符串，并删除收尾空格
function splitByComma(str) {
  return str.split(',').map(n => n.trim()).filter(n => n);
}

// 自动探测可能的配置文件名，后缀优先级：.js > .json > .yaml
function getExistsConfigFileName(file) {
  const extnames = [ '', '.js', '.json', '.yaml', '.yml' ];
  for (const ext of extnames) {
    const f = file + ext;
    if (fs.existsSync(f)) {
      return f;
    }
  }
}

class Scaffolding extends ProjectCore {

  /**
   * 创建脚手架实例
   *
   * @param {Object} options
   *   - {String} configDir
   *   - {String} configExtname
   *   - {String} env
   */
  constructor(options) {
    super();

    // eslint-disable-next-line
    options = Object.assign({}, options || {});

    // 配置文件目录
    this._configDir = path.resolve(options.configDir || './config');
    // 配置名称
    this._configNames = splitByComma(options.env || process.env.NODE_ENV || '');
    this._configNames.unshift('default');
    // 加载配置文件
    this._loadedConfigNames = [];
    this._configNames.forEach(n => {
      const f = getExistsConfigFileName(path.resolve(this._configDir, `${ n }`));
      if (!f) {
        // 如果是 default 不存在则不载入
        if (n === 'default') return;
        throw new Error(`config file not found: ${ f }`);
      }
      this.config.load(f);
      this._loadedConfigNames.push(f);
    });

    // 日志记录器
    this._logger = {};
    this._bunyan = bunyan;

    // 用于存储全局数据
    this._ns = createNamespace();

    // 打印已载入的配置
    this.getLogger('init').info(`loaded configs: ${ this._loadedConfigNames.join(', ') }`);
  }

  /**
   * 取数据
   *
   * @param {String} name
   * @return {Object}
   */
  get(name) {
    return this._ns.get(name);
  }

  /**
   * 设置数据
   *
   * @param {String} name
   * @param {Object} value
   * @return {Object}
   */
  set(name, value) {
    return this._ns.set(name, value);
  }

  /**
   * 获得一个日志记录器
   *
   * @param {String} name
   * @return {Object}
   */
  getLogger(name) {
    if (this._logger[name]) {
      return this._logger[name];
    }
    return this.createLogger(name);
  }

  /**
   * 创建日志记录器
   *
   * @param {String} name
   * @param {Object} config
   * @return {Object}
   */
  createLogger(name, config) {
    // eslint-disable-next-line
    config = Object.assign({ name }, config);
    if (this.config.has(`logger.${ name }`)) {
      Object.assign(config, this.config.get(`logger.${ name }`));
    }
    this._logger[name] = bunyan.createLogger(config);
    return this._logger[name];
  }

  /**
   * 初始化模块
   *
   * @param {String} name
   * @param {String|Object} config
   * @return {Object}
   */
  module(name, config) {
    const ref = {};
    this.init.add(done => {
      this.getLogger('init').info(`initing module ${ name }`);
      // 获取配置
      if (!config) {
        // 如果为空则自动读取以模块命名的配置项
        // eslint-disable-next-line
        config = this.config.get(name);
      } else if (typeof config === 'string') {
        // 如果是字符串则自动读取指定配置项
        // eslint-disable-next-line
        config = this.config.get(config);
      }
      // eslint-disable-next-line
      config = Object.assign({}, config || {});
      // 载入模块并初始化
      const init = require(`bamei-module-${ name }`);
      init.call(this, ref, config, err => {
        if (err) {
          this.getLogger('init').error(`initing module ${ name } error: ${ err.stack }`);
        } else {
          this.getLogger('init').info(`initing module ${ name } success`);
        }
        process.nextTick(() => done(err));
      });
    });
    // 设置到 ns 中
    this.set(name, ref);
    return ref;
  }

}

exports.Scaffolding = Scaffolding;

exports.create = function createScaffolding(options) {
  return new Scaffolding(options);
};