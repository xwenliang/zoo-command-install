/*
 * fis
 * http://fis.baidu.com/
 */

'use strict';

exports.name = 'install';
exports.usage = '<names> [path] [options]';
exports.desc = 'install components and demos';
exports.register = function(commander){
    
    commander
        .option('--repos <url>', 'repository', String)
        .action(function(){
           //创建本地路径
            function mkdirLocal(path, fn){
                fs.exists(path, function(exists){
                    if(!exists){
                        fs.mkdir(path, function(err){
                            if(err){
                                console.log(err);
                                return;
                            }
                            fn()
                        });
                        return;
                    }
                    fn();
                });
            }
            //访问github 模板地址 获得 模块下文件和目录地址
            function getPath(url){
                var options = {
                    hostname: githubViewHost,
                    port: githubViewPort,
                    path: url,
                    method: 'GET',
                    agent: false
                };
                var req = https.request(options, function(res){
                    //console.log('状态码1：' + res.statusCode);
                    res.setEncoding('utf8');
                    res.on('data', function(chunk){
                        var reg = /a href="(.+)" class="js-directory-link js-navigation-open"/g;
                        var links = reg.exec(chunk);
                        var tempPathArr = [];
                        if(links && links[1]){
                            tempPathArr.push(links[1]);
                            //创建本地目录
                            //tree blob
                            for(var i = 0; i < tempPathArr.length; i++){
                                var path = tempPathArr[i];
                                if(/\/tree\//.test(path)){
                                    //dir /xwenliang/mobile_modules/tree/master/modules/Zepto/lib
                                    var tempDir = /\/(modules.+)$/.exec(path).length > 0 ? /\/(modules.+)$/.exec(path)[1] : null;
                                    mkdirLocal(processPath + '/' + tempDir, function(){
                                        getPath(path);
                                    });  
                                }else{
                                    //file /xwenliang/mobile_modules/blob/master/modules/Zepto/zepto.js
                                    var regArr = /\/modules\/(.+)\.(\w+)/g.exec(path);
                                    var filePath = regArr.length > 1 ? regArr[1] : null;
                                    var fileType = regArr.length > 2 ? regArr[2] : null;
                                    if(!filePath || !fileType){
                                        return;
                                    }
                                    getContent(processPath + '/modules/' + filePath + '.' + fileType, path.replace(/blob\//, ''));
                                }
                            }
                        }
                        
                    });
                });
                req.end();
            }
            //访问文件地址 获得文件内容
            function getContent(filePath, url){
                //console.log(filePath);
                var options = {
                    hostname: githubDownHost,
                    port: githubDownPort,
                    path: url,
                    method: 'GET',
                    agent: false
                };
                var req = https.request(options, function(res){
                    //console.log('状态码2：' + res.statusCode);
                    res.setEncoding('utf8');
                    res.on('data', function(chunk){
                       var out = fs.createWriteStream(filePath);
                       out.write(chunk);
                        
                    });
                });
                req.end();
            }
           
            //读取package.json
            fs.readFile(processPath + '/package.json', function(err, data){
                if(err){
                    console.log('read package.json error:' + err);
                    return;
                }
                var modulesObj = JSON.parse(data)['modules-dependencies'];
                var modulesKeys = Object.keys(modulesObj);
                //下载modules 写入modules文件夹
                var len = modulesKeys.length;
                if(!len){
                    console.log('not set modules-dependencies');
                    return;
                }
                mkdirLocal(processPath + '/modules', function(){
                    for (var i = 0; i < len; i++){
                        (function(i){
                            var moduleName = modulesKeys[i];
                            mkdirLocal(processPath + '/modules/' + moduleName, function(){
                                getPath(githubViewPath + '/' + moduleName);
                            });
                        })(i)
                        
                    }
                });
                
            });
        });
};