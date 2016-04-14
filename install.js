/*
 * zoo
 * http://beefe.github.io/
 */

'use strict';

var fs = require('fs');
var https = require('https');
var http = require('http');
var path = require('path');
var jsdom = require('jsdom');
//执行路径
var processPath = process.cwd();
var jquery = fs.readFileSync(path.join(__dirname, '/node_modules/jquery/dist/jquery.min.js'), "utf-8");
//配置文件名
var confFileName = 'zoo.json';
//项目名称
var projectName = '';
//本地存放下载模块的文件夹名，可以在zoo.json里面设置，默认是common
var downloadDirName = 'common';
//远程目录名
var modulesViewDirName = 'common';
//是否强制安装
var isForce = false;

var protocal = 'http',
    port = '80',
    host = 'gitlab.i.beebank.com',
    viewPath = '/beefe/common/tree/master',
    downloadPath = '/beefe/common/blob/master',
    //页面链接提取规则
    selector = 'span.str-truncated a';


var modulesOptions = {};
var targetArr = [];//配置文件中要下载的component数组
var module_i = 0;//开始下载第i个module
var modulesExistArr = [];

//创建本地路径
function mkdirLocal(path, fn){
    new Promise(function(resolve, reject){
        fs.exists(path, function(exists){
            if(exists){
                return resolve();
            }
            fs.mkdir(path, function(err){
                if(err){
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }).then(function(){
       fn();
    }).catch(function(msg){
        console.log(msg);
        downNextModule();
    });
};

function downModule(i){
    var moduleName = targetArr[i];
    var moduleExist = false;
    modulesExistArr.forEach(function(v, i){
        if(moduleName == v){
            moduleExist = true;
        }
    });
    //强制下载
    if(isForce || !moduleExist){
        mkdirLocal(path.join(processPath, downloadDirName, moduleName), function(){
            getPath(protocal + '://' +path.join( host, downloadPath, moduleName));
        });
    }
    else{
        var prompt = require('prompt');
        prompt.start();
        var tip = moduleName + '模块已存在,是否要覆盖？（y/n）';
        prompt.get([tip], function(err, result){
            if(result[tip] == 'y'){
                mkdirLocal(path.join(processPath, downloadDirName, moduleName), function(){
                    getPath(protocal + '://' +path.join( host, downloadPath, moduleName));
                });
            }else{
                downNextModule();
            }
        });
    }
};

function downNextModule(){
    module_i++;
    if(module_i < targetArr.length){
        downModule(module_i)
    }
};
//访问github 模板地址 获得 模块下文件和目录地址

function getPath(url){

    new Promise(function(resolve, reject){

        jsdom.env({
            url: url,
            src: [jquery],
            done: function (err, window) {
                if(err){
                    reject(err);
                    return;
                }
                resolve(window);
            }
        })
        
    }).then(function(window){

        var $ = window.$;
        var links = $(selector);
        var hasMoreFile = false;
        for(var i = 0; i < links.length; i++){
            var href = links[i].href;
            //判断是文件还是目录，通过判断链接是不是有'.'，可行吗？
            if(href.replace(protocal+'://'+host, '').indexOf('.') > -1){
                modulesOptions[targetArr[module_i]]['linkArr'].push(href);
            }else{
                hasMoreFile = true;
                var moduleName = href.split(viewPath)[1];
                mkdirLocal(path.join(processPath, downloadDirName, moduleName), function(){});
                getPath(href);
            }
        }
        if(!hasMoreFile){
            //下载模块下所有文件
            var len = modulesOptions[targetArr[module_i]]['linkArr'].length;
            modulesOptions[targetArr[module_i]]['linkArr'].forEach(function(v, i){
                var filePath = v.split(downloadPath)[1];
                getContent(path.join(processPath, downloadDirName, filePath), v.replace(/\/blob\//, '/raw/'), len);
            });
        };

    }).catch(function(msg){
        console.log(msg);
        downNextModule();
    });
};
//访问文件地址 获得文件内容
function getContent(filePath, url, len){
    var dirNum = 0;
    var moduleName = targetArr[module_i];
    if(!moduleName){return}
    var req = http.request(url, function(res){
        if(res.statusCode != 200){
            console.log('down ' + moduleName + ' error');
            downNextModule();
            return;
        }
        if(modulesOptions[targetArr[module_i]]['downingStart'] == false){
            process.stdout.write('正在下载' + moduleName +'.');
        }else if(modulesOptions[targetArr[module_i]]['downingStart'] == true){
            process.stdout.write('.');
        }
        modulesOptions[targetArr[module_i]]['downingStart'] = true;
        //res.setEncoding('utf8');//with this line, write images will make error, why?
        var out = fs.createWriteStream(filePath);
        res.pipe(out);
        
        res.on('data', function(){        
        });
        res.on('end', function(){
            modulesOptions[targetArr[module_i]]['downedNum']++;
            if(modulesOptions[targetArr[module_i]]['downedNum'] == len){
                process.stdout.write(moduleName.green.bold + '下载完成'.green.bold + '\n');
                downNextModule();
            }
        });
    });
    req.end();
};

//生成fis-conf.js
function touchFisConf(){
    var filePath = path.join(processPath, 'fis-conf.js');
    var content = 

`//项目配置文件

//项目名称
var name = '/${projectName}';
//项目domain，一般写测试domain
var domain = '';

fis.config.merge({
    statics: name,
    roadmap: {
        domain: domain,
        path: [
            //非模块化的js，如mod.js
            {
                reg: /^\\/${downloadDirName}\\/mod\\/mod\\.js/,
                isMod: false,
                release: '\$\{statics\}/$&'
            },
            //公共模块
            {
                reg: /^\\/${downloadDirName}\\/([^\\/]+)\\/(?:[^\\/]+)\\.js/,
                isMod: true,
                id: '$1',
                release: '\$\{statics\}/$&'
            },
            //模板
            {
                reg: /^(.*)\\.(html|htm|phtml)$/i,
                isHtmlLike: true,
                useCache: false,
                release: '\$\{statics\}/$&'
            },
            //css文件
            {
                reg: /^(.*)\\.(css|less)$/i,
                useSprite: true,
                release: '\$\{statics\}/$&'
            },
            //图片等媒体文件
            {
                reg: /^(.*)\\.(jpg|gif|png|mp3|mp4|ttf|pdf)$/i,
                release: '\$\{statics\}/$&'
            },
            //前端模版
            {
                reg: '**.tpl',
                useOptimizer: false,
                useCache: false
            },
            //打包后的资源
            {
                reg: 'pkg/**.js',
                release: '\$\{statics\}/$&'
            },
            //依赖关系表
            {
                reg: 'map.json',
                release: '\$\{statics\}/$&'
            },
            //其他上文未匹配到的
            {
                reg : "**",
                release : false
            }
        ],
        pack: {
            'pkg/common.js': [
                '${downloadDirName}/mod/mod.js',
                '${downloadDirName}/**.js'
            ]
        },
        deploy: {
            //测试机
            test: [
                {
                    from: '',
                    to: '',
                    include: '',
                    replace: {
                        from: '',
                        to: ''
                    },
                    subOnly: true
                }
            ],
            //线上
            online: [
                {
                    from: '',
                    to: '',
                    include: '',
                    replace: {
                        from: '',
                        to: ''
                    },
                    subOnly: true
                }
            ]
        }
    }
});`;

    new Promise(function(resolve, reject){
        fs.exists(filePath, function(exists){
            if(exists){
                return;
            }
            else{
                resolve();
            }
        });
    }).then(function(){
        fs.writeFile(filePath, content, function(err){
            if(err){
                reject({
                    tips: 'write fis-conf.js error',
                    err: err
                });
            }
        });
    }).catch(function(err){
        console.log(err);
    });
};

exports.name = 'install';
exports.usage = '[options]';
exports.desc = 'install components and create fis-zoo.js';
exports.register = function(commander){
    commander
        .option('-F', ' do not detect local files, force to overwrite', String)
        .option('-S', ' set source of component to be downloaded, todo')
        .action(function(){
            var args = Array.prototype.slice.call(arguments);
            isForce = args[0]['F'];
            //读取配置文件
            new Promise(function(resolve, reject){
                fs.readFile(path.join(processPath, confFileName), function(err, data){
                    if(err){
                        reject('当前目录没有找到'+confFileName);
                        return;
                    }
                    var options = JSON.parse(data);
                    projectName = options['name'] || projectName;
                    downloadDirName = options['downloadDirName'] || downloadDirName;
                    targetArr = options['components'];
                    targetArr.forEach(function(v, i){
                        modulesOptions[v] = {};
                        modulesOptions[v]['downingStart'] = false;
                        modulesOptions[v]['downedNum'] = 0;
                        modulesOptions[v]['linkArr'] = [];
                    });
                    //生成fis-conf.js
                    touchFisConf();
                    //下载components 写入download文件夹
                    var len = targetArr.length;
                    if(!len){
                        reject('请确保components字段不为空');
                        return;
                    }
                    resolve();
                });
            })
            .then(function(){

                mkdirLocal(path.join(processPath, downloadDirName), function(){
                    //判断配置文件中模块是否已存在
                    new Promise(function(resolve, reject){

                        jsdom.env({
                            url: protocal + '://' + path.join(host, viewPath),
                            src: [jquery],
                            done: function (err, window) {
                                if(err){
                                    reject();
                                    return;
                                }
                                resolve(window);
                            }
                        });

                    }).then(function(window){

                        return new Promise(function(resolve, reject){
                            var $ = window.$;
                            var links = $(selector);
                            //辅助判断targetArr中的模块在remote仓库中是否存在的对象
                            var judgeExistHelper = {};
                            var remoteExistArr = [].map.call(links, function(link, i){
                                judgeExistHelper[link.innerHTML] = 1;
                                return link.innerHTML;
                            });

                            var tempArr = targetArr;
                            targetArr = tempArr.filter(function(component, i){
                                if(component in judgeExistHelper){
                                    return true;
                                }
                                else{
                                    console.log(`仓库${protocal}://${path.join(host, viewPath)}中没有${component}模块`);
                                }
                            });

                            if(!targetArr.length){
                                console.log(`${confFileName}没有可用的模块`);
                                return;
                            }
                            resolve();
                        });
                        
                    }).then(function(){

                        return new Promise(function(resolve, reject){
                            fs.readdir(path.join(processPath, downloadDirName), function(err, files){
                                if(err){
                                    reject(err);
                                    return;
                                }
                                resolve(files)
                            })
                        });

                    }).then(function(files){

                        files.forEach(function(v, i){
                            modulesExistArr.push(v);
                        });
                        downModule(module_i);

                    }).catch(function(err){
                        console.log(err);
                    });
                });
            }).catch(function(msg){
                console.log(msg);
            });

        });
};