/*
 * fis
 * http://fis.baidu.com/
 */

'use strict';

exports.name = 'install';
exports.usage = '<names> [path] [options]';
exports.desc = 'install components and demos';
exports.register = function(commander){
    var fs = require('fs');
    var https = require('https');
    var http = require('http');
    var path = require('path');
    var jsdom = require('jsdom');
    //执行路径
    var processPath = process.cwd();
    var jquery = fs.readFileSync(__dirname + '/libs/jquery.js', "utf-8");
    //配置文件名
    var confFilename = 'package.json';
    //模板下载文件夹
    var modulesDir = '';
    var modulesViewDirName = 'common-modules';//在github上zoo-modules的最后一个目录名称
    //页面中url  eg:  https://github.com/xwenliang/mobile_modules/blob/master/modules/Zepto/zepto.js
    //读取文件url eg:  https://raw.githubusercontent.com/xwenliang/mobile_modules/master/modules/Zepto/zepto.js
    var githubViewProtocol = 'https',
        githubDownProtocol = 'https',
        githubViewPort = '443',
        githubViewHost = 'github.com',
        githubViewPath = '/beefe/zoo-modules/tree/master/' + modulesViewDirName,
        githubDownPort = '443',
        githubDownHost = 'raw.githubusercontent.com',
        githubDownPath = '/beefe/zoo-modules/master/' + modulesViewDirName;


    var modulesOptions = {};
    var modulesArr = [];
    var module_i = 0;//开始下载第i个module
    var modulesExitArr = [];

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
    }
    function downModule(i){
        var moduleName = modulesArr[i];
        var moduleExit = false;
        modulesExitArr.forEach(function(v, i){
            if(moduleName == v){
                moduleExit = true;
            }
        });
        if(moduleExit == true){
            var prompt = require('prompt');
            prompt.start();
            var tip = moduleName + '模块已存在,是否要覆盖？（y/n）';
            prompt.get([tip], function(err, result){
                if(result[tip] == 'y'){
                    mkdirLocal(path.join(processPath, modulesDir, moduleName), function(){
                        getPath(githubViewProtocol + '://' +path.join( githubViewHost, githubViewPath, moduleName));
                    });
                }else{
                    downNextModule();
                }
            })
        }else{
            mkdirLocal(path.join(processPath, modulesDir, moduleName), function(){
                getPath(githubViewProtocol + '://' +path.join( githubViewHost, githubViewPath, moduleName));
            });
        }
        
    };

    function downNextModule(){
        module_i++;
        if(module_i < modulesArr.length){
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
            var links = $('.files a[id]');
            var hasMoreFile = false;
            for(var i = 0; i < links.length; i++){
                var href = links[i].href;
                if(href.replace('github.com', '').indexOf('.') > -1){
                    modulesOptions[modulesArr[module_i]]['linkArr'].push(href);
                }else{
                    getPath(href);
                    hasMoreFile = true;
                    var tempDir = new RegExp('/' + modulesViewDirName + '/' + '(.+)').exec(href)[1];
                    mkdirLocal(path.join(processPath, modulesDir, tempDir), function(){

                    });
                }
            }
            if(!hasMoreFile){
                //下载模块下所有文件
                var len = modulesOptions[modulesArr[module_i]]['linkArr'].length;
                modulesOptions[modulesArr[module_i]]['linkArr'].forEach(function(v, i){
                    var filePath = new RegExp('/' + modulesViewDirName + '/' + '(.+)').exec(v)[1];
                    getContent(path.join(processPath, modulesDir, filePath), v.replace(githubViewProtocol + '://' + githubViewHost, '').replace(/blob\//, ''), len);
                });
            };
        }).catch(function(msg){
            console.log(msg);
            downNextModule();
        });
        
    }
    //访问文件地址 获得文件内容
    function getContent(filePath, url,len){
        var dirNum = 0;
        var options = {
            hostname: githubDownHost,
            port: githubDownPort,
            path: url,
            method: 'GET',
            agent: false
        };
        var moduleName = modulesArr[module_i];
        if(!moduleName){return}
        var req = require(githubDownProtocol).request(options, function(res){
            if(res.statusCode != 200){
                console.log('down ' + moduleName + ' error');
                downNextModule();
                return;
            }
            if(modulesOptions[modulesArr[module_i]]['downingStart'] == false){
                process.stdout.write('正在下载' + moduleName +'.');
            }else if(modulesOptions[modulesArr[module_i]]['downingStart'] == true){
                process.stdout.write('.');
            }
            modulesOptions[modulesArr[module_i]]['downingStart'] = true;
            res.setEncoding('utf8');
            var out = fs.createWriteStream(filePath);
            res.pipe(out);
            
            res.on('data', function(){                
            });
            res.on('end', function(){
                modulesOptions[modulesArr[module_i]]['downedNum']++;
                if(modulesOptions[modulesArr[module_i]]['downedNum'] == len){
                    process.stdout.write(moduleName.green.bold + '下载完成'.green.bold + '\n');
                    downNextModule();
                }
            });
        });
        req.end();
    }
    commander
        .option('--repos <url>', 'repository', String)
        .action(function(){            
            //读取package.json
            new Promise(function(resolve, reject){
                fs.readFile(processPath + '/' + confFilename, function(err, data){
                    if(err){
                        reject('\n [error] ' + err + '\n');
                        return;
                    }
                    var commonModulesOptions = JSON.parse(data)['modules-dependencies'];
                    modulesDir = commonModulesOptions['dirName'];
                    modulesArr = commonModulesOptions['modules'];
                    modulesArr.forEach(function(v, i){
                        modulesOptions[v] = {};
                        modulesOptions[v]['downingStart'] = false;
                        modulesOptions[v]['downedNum'] = 0;
                        modulesOptions[v]['linkArr'] = [];
                    });
                    //下载modules 写入modules文件夹
                    var len = modulesArr.length;
                    if(!len){
                        reject('not set modules-dependencies');
                        return;
                    }
                    resolve();
                });
            })
            .then(function(){
                mkdirLocal(path.join(processPath, modulesDir), function(){
                    
                    //判断配置文件中模块是否存在
                    new Promise(function(resolve, reject){
                        jsdom.env({
                            url: githubViewProtocol + '://' + path.join(githubViewHost + githubViewPath),
                            src: [jquery],
                            done: function (err, window) {
                                if(err){
                                    reject(err);
                                    return;
                                }
                                resolve(window);
                                
                            }
                        });
                    }).then(function(window){
                        new Promise(function(resolve, reject){
                            var $ = window.$;
                            var links = $('.files a[id]');
                            var arrModulesArr = [];
                            for(var i = 0; i < links.length; i++){
                                var href = links[i].href;
                                var moduleName = new RegExp('/' + modulesViewDirName + '/' + '(.+)').exec(href)[1];
                                arrModulesArr.push(moduleName);
                            }

                            modulesArr.forEach(function(v, i){
                                var hasModule = false;
                                arrModulesArr.forEach(function(w, j){
                                    if(v == w){
                                        hasModule = true;
                                    }
                                });
                                if(hasModule == false){
                                    console.log(modulesViewDirName +'中没有' + v + '模块');
                                    modulesArr.splice(i, 1);
                                }
                            });

                            if(!modulesArr.length){
                                console.log(confFilename + '没有可用的模块');
                                return;
                            }
                            resolve();
                        })
                        
                    }).then(function(){
                        return new Promise(function(resolve, reject){
                            fs.readdir(path.join(processPath, modulesDir), function(err, files){
                                if(err){
                                    console.log(err);
                                    reject(err);
                                    return;
                                }
                                resolve(files)
                            })
                        })
                    }).then(function(files){
                        files.forEach(function(v, i){
                            modulesExitArr.push(v);
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