
# BScriptRunner

"bscript" - скрипт с особым синтаксиом и предназначен для дебагинга кода для nodejs скрипта. BScriptRunner это небольшая библиотека для nodejs, она предназначена для запуска скриптов "bscript" в режиме рантайма.
## Установка
```bash
# npm
npm i bscriptrunner

# yarn
yarn bscriptrunner
```

## Использование
```
const BScriptRunner = require('BScriptRunner').BScriptRunner;
const bScriptRunner = new BScriptRunner(CMDEnviroment, {/*...*/} // optional );
bScriptRunner.Create(`
print 123
print ${str 123}
print ${num 123}
`) // BScript)
bScriptRunner.executer() //* 
    [NOTYPE 123]
    123
    123
*//
```

```nodejs
const BScriptRunner = require('BScriptRunner').BScriptRunner;
const bScriptRunner = new BScriptRunner(CMDEnviroment, {/*...*/} // optional );
bScriptRunner.Create("print 123; print ${str 123}; print ${num 123}") // BScript)
bScriptRunner.executer() //* 
    [NOTYPE 123]
    123
    123
*//
```
