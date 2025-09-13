const fs = require('fs')
const path = require('path')

function baseInterpolation(text) {
	return eval('`' + text + '`')
}

function interpolation(text, tag, ...args) {
	return text.split(tag).map((t, i) =>  (i < args.length ) ? t + args[i] : t).join("");
}

function findQuotedText(text) {
	const regex = /(?<!\\)(["'])([\s\S]*?)(?<!\\)\1/g;
	const results = []
	while ((array = regex.exec(text)) !== null) {
	    results.push({
	        text: array[2],
	        indexStart: array.index,
	        indexEnd: array.index + array[0].length
	    });
	}
    return results;
}

const commandSplitter = (text) => {
	const quotedText = findQuotedText(text);
	let a = 0;
	_text = quotedText.reduce((text, x, index) => {
		const newText = x ? text.slice(0, x.indexStart-a) + "{quoted}" + text.slice(x.indexEnd + a, text.length) : text;
		a += text.length - newText.length;
		return newText;
	}, text)
	const args = text ? _text
		.split("{quoted}")
		.filter(x=>x != "")
		.reduce(
			(arr, el, i) => 
				[
					...arr, 
					...el.split(" ").filter(x=>x != ""), 
					baseInterpolation(quotedText[i]?.text??"")], []): []
	const commandName = args[0];
	args.shift();

	return (
		{ 
			command: commandName, 
			args:  args
		}
	)
}

module.exports = class BScriptRunner {
	constructor(cmdEnviroment, options) {
		this.options = {
			silent: false,
			 ...options
		}
		this.executer = null;
		this.cmdEnviroment = cmdEnviroment;
		this.mainScript = null;
		this.paths = {}
		this.scopePathId = options?.scopePathId??"root";
		this.__baseDir = process.cwd();
		this.scopes = {
			root: { $val: { __baseDir: this.__baseDir } },
			...(options?.scopes??{})
		}
		this.regexExpression = {
			scriptFrame: /(.*.)/g,
			assigningValue: /\$\((.*)\)=/,
			preRunClean: /^[\n\s\t]*/gm,
		}
	}
    pathIdInfo(pathId) {
    	const splitedPathId = pathId.split(":");
    	return ({
    		typePath: splitedPathId[0],
    		scopeIteractionIndex: Numaber(splitedPathId[2]),
    		childsCount: Numaber(splitedPathId[2])
    	})
    }
    getScope() {
    	return Object.values(this.scopes).reduce((acc, e)=>({$arg: [...(acc.$arg??[]), ...(e.$arg??[])], $val: {...(acc.$val??{}), ...(e.$val??{})}}))
    }
	setArgsToScope(scopeArgs, scopePathId) {
		if(!this.scopes[scopePathId])
			this.scopes[scopePathId] = {$arg: [], $val: {}};
		this.scopes[(scopePathId??"root")].$arg = scopeArgs;
	}
	setValueToScope(scopeValName, scopeVal, scopePathId) {
		if(!this.scopes[scopePathId])
			this.scopes[scopePathId] = {$arg: [], $val: {}};
		this.scopes[(scopePathId??"root")].$val = { ...(this.scopes[(scopePathId??"root")].$val??{}), [scopeValName]: scopeVal };
	}
    commandExist(commandName) {
    	return !!this.cmdEnviroment._commands[commandName];
    }
    async commandExecute({commandName, options, args}) {
    	if(!this.commandExist(commandName)) {
    		if(!options?.silent){
    			throw new Error(`Command "${commandName}" not found! Try write "help" command.`);
    		}
			return { errorCode: -1};
    	}
    	try {				
    		return await this.cmdEnviroment._commands[commandName].execute.bind(this)(...args);
    	} catch(e) {
			this.cmdEnviroment.commandController.Print(e.message.replace("\n", ""));
		}
    }
    scriptPathFinder(script, type) {
    	const results = [];
    	const findPathRegex = new RegExp(`\\$\\((${type}:path:([0-9]+):([0-9]+))\\)`, 'g');
    	let regexPathFound;
    	while ((regexPathFound = findPathRegex.exec(script)) !== null) {
    		const scope = { 
    			type,
    			beforePath: script.slice(0, regexPathFound.index), 
    			afterPath: script.slice(regexPathFound.index+regexPathFound[0].length, script.length), 
    			...this.paths[regexPathFound[1]], 
    			path: regexPathFound[1],
    			scopeIteractionIndex: Number(regexPathFound[2]), 
    			childsCount: Number(regexPathFound[3]), 
    			getChilds: (parentInclude) => [...Array(scope.scopeIteractionIndex+(parentInclude ? 1 : 0)).keys()].map(sii => [...Array(scope.childsCount+(parentInclude ? 1 : 0)).keys()].map(cc => `${type}:path:${sii}:${cc}`)), 
    		}
    		results.push(scope);
    	}
    	return results.length > 0 ? results : null;
    }
    scriptQuotedPathFinder(script) {
    	const results = [];
    	const findQuotedPathRegex = /\$\((quoted:path:([0-9]+):([0-9]+))\)/g;
    	let regexQuotedPathFound;
    	while ((regexQuotedPathFound = findQuotedPathRegex.exec(script)) !== null) {
    		const scope = { 
    			beforeQuoted: script.slice(0, regexQuotedPathFound.index), 
    			afterQuoted: script.slice(regexQuotedPathFound.index+regexQuotedPathFound[0].length, script.length), 
    			quotedContent: this.paths[regexQuotedPathFound[1]]?.quotedContent, 
    			quotedPath: regexQuotedPathFound[1],
    			quotedIteractionIndex: Number(regexQuotedPathFound[2]), 
    			childsCount: Number(regexQuotedPathFound[3]), 
    			getChilds: (parentInclude) => [...Array(quoted.quotedIteractionIndex+(parentInclude ? 1 : 0)).keys()].map(qii => [...Array(quoted.childsCount+(parentInclude ? 1 : 0)).keys()].map(cc => `quoted:path:${qii}:${cc}`)), 
    		}
    		results.push(scope);
    	}
    	return results.length > 0 ? results : null;
    }
    scriptFormatter(runScript) {
    	const _quoteCombine = (script, mirrorOffsetFrame = -1, _rawFrameInfo = []) => {
			if(mirrorOffsetFrame == -1){
				const x = _quoteCombine(script, 0);
				const paths = x.rawFrameInfo.map((x, index, array) => array[(array.length-1)-index]).reduce((acc, e) => ({...acc, [e.path]: e}), {});
				return { mainScript: x.clearScript, paths };
			}

			const regexQuoteFrame = /([`])([\S\s]*?)(\1)/g;
			let regexQuoteFrameFound;

			if(!script.match(regexQuoteFrame))
				return { rawFrameInfo: _rawFrameInfo, clearScript: script };
		
	    	const rawFrameInfo = []

			let newScriptUnparsed = script;
			let offsetFoundIndex = 0;
			let currentFrameScopeIndex = 0;
			let quoteToPush = null;
			while ((regexQuoteFrameFound = regexQuoteFrame.exec(script)) !== null) {
				quoteToPush = { quoteText: regexQuoteFrameFound[2], mirrorOffsetFrame, path: `quote:path:${mirrorOffsetFrame}:${currentFrameScopeIndex}`}

			    rawFrameInfo.push(quoteToPush)
				newScriptUnparsed = newScriptUnparsed.slice(0, regexQuoteFrameFound.index - offsetFoundIndex) + `$(quote:path:${mirrorOffsetFrame}:${currentFrameScopeIndex})` + newScriptUnparsed.slice(regexQuoteFrameFound.index + regexQuoteFrameFound[0].length - offsetFoundIndex, newScriptUnparsed.length);
			    offsetFoundIndex = script.length - newScriptUnparsed.length;
			    currentFrameScopeIndex++;
			}
			return _quoteCombine(newScriptUnparsed, ++mirrorOffsetFrame, [..._rawFrameInfo, ...rawFrameInfo]);
    	}

    	
    	const _scopeCombine = (script, mirrorOffsetFrame = -1, _rawFrameInfo = []) => {		
			if(mirrorOffsetFrame == -1){
				const x = _scopeCombine(script, 0);
				const paths = x.rawFrameInfo.map((x, index, array) => array[(array.length-1)-index]).reduce((acc, e) => ({...acc, [e.path]: e}), {});
				return { mainScript: x.clearScript, paths };
			}

			const regexScopeFrame = /(?=(\{([^\{\}]*(?:\{[^\{\}]*\}[^\{\}]*)*)\})){([^\{\}]*)}/g;
			let regexScopeFrameFound;

			if(!script.match(regexScopeFrame))
				return { rawFrameInfo: _rawFrameInfo, clearScript: script };
		
	    	const rawFrameInfo = []

			let newScriptUnparsed = script;
			let offsetFoundIndex = 0;
			let currentFrameScopeIndex = 0;
			let scopeToPush = null;
			while ((regexScopeFrameFound = regexScopeFrame.exec(script)) !== null) {
				scopeToPush = { scopeScript: regexScopeFrameFound[2], mirrorOffsetFrame, path: `scope:path:${mirrorOffsetFrame}:${currentFrameScopeIndex}`}

			    rawFrameInfo.push(scopeToPush)
				newScriptUnparsed = newScriptUnparsed.slice(0, regexScopeFrameFound.index - offsetFoundIndex) + `$(scope:path:${mirrorOffsetFrame}:${currentFrameScopeIndex})` + newScriptUnparsed.slice(regexScopeFrameFound.index + regexScopeFrameFound[0].length - offsetFoundIndex, newScriptUnparsed.length);
			    offsetFoundIndex = script.length - newScriptUnparsed.length;
			    currentFrameScopeIndex++;
			}
			return _scopeCombine(newScriptUnparsed, ++mirrorOffsetFrame, [..._rawFrameInfo, ...rawFrameInfo]);
    	}
    	
    	const quoteCombined = _quoteCombine(runScript);
    	runScript = quoteCombined.mainScript;
    	runScript = runScript.replace(this.regexExpression.preRunClean, "");
    	const scopeCombined = _scopeCombine(runScript);


    	return { paths: { ...scopeCombined.paths, ...quoteCombined.paths }, mainScript: scopeCombined.mainScript }
	}

	UnFormateScopes(script) {
		let scopes = this.scriptPathFinder(script, 'scope');
		if(!scopes)
			return script;
		scopes.map((scope) => {
			script = script.replace(`$(${scope.path})`, `{${scope.scopeScript}}`)
		})
		return this.UnFormateScopes(script);
	}

	Create(run, _paths) {
		const { mainScript, paths } = this.scriptFormatter(run);
		this.mainScript = mainScript;
		this.paths = _paths??paths;
		this.executer = async (...args) => {
			this.setArgsToScope(args, this.scopePathId??"root");
			let results = []
	    	let regexFrameFound;
		    while((regexFrameFound = this.regexExpression.scriptFrame.exec(this.mainScript)) != null) {
		    	for(let i = 0; i < regexFrameFound[0].split(";").length; i++) {
		    		let frameScript = regexFrameFound[0].split(";")[i];
		    		// Import
		    		try {
						frameScript = fs.readFileSync(path.join(this.__baseDir, frameScript.replace(" ")), { encoding: 'utf8', flag: 'r' });
		    			const importScope = new BScriptRunner(this.cmdEnviroment, { silent: true })	
						importScope.Create(frameScript);
		    			await importScope.executer();
		    			if(!this.scopes[this.scopePathId])
							this.scopes[this.scopePathId] = {$arg: [], $val: {}};
		
						this.scopes[(this.scopePathId??"root")].$val = { ...this.scopes[(this.scopePathId??"root")].$val, ...importScope.scopes.root?.$val??[] };
						continue;
					} catch(e) {}
					// /////////
		    		let scopes = this.scriptPathFinder(frameScript, 'scope');
		    		let quotes = this.scriptPathFinder(frameScript, 'quote');
		    		if(scopes){
		    			const assignment = this.regexExpression.assigningValue.exec(scopes[scopes.length-1].beforePath)?.[1];
		    			const isFunc = scopes[0].beforePath.endsWith("FUNC=>");
		    			const isAsync = scopes[0].beforePath.endsWith("ASYNC");
		    			const isArg = scopes[0].beforePath.endsWith("$");
		    			const isText = scopes[0].beforePath.endsWith("TEXT");
		    			const isNum = scopes[0].beforePath.endsWith("NUM");
		    			const isIf = scopes[0].beforePath.startsWith("IF");
		    			let scopesInAssigment;
		    			if(assignment && (scopesInAssigment = this.scriptPathFinder(assignment, 'scope'))) {		
	    					const assignmentScope = new BScriptRunner(this.cmdEnviroment, { silent: true, scopes: this.scopes, scopePathId: scopes[0].path })	
							assignmentScope.Create(scopesInAssigment[0].scopeScript, this.paths);
							let val;
							if((val = await assignmentScope.executer())?.type == "ref") {
								const scopeLast = new BScriptRunner(this.cmdEnviroment, { silent: true, scopes: this.scopes, scopePathId: scopes[scopes.length-1].path })					
								scopeLast.Create(scopes[scopes.length-1].scopeScript, this.paths);
								val.set((await scopeLast.executer()))
								continue;
							} else if(val?.type == "text") {
								this.setValueToScope(assignment, val, this.scopePathId??"root");
								continue;
							}				
		    			}

		    			if(isIf){
							const scope0 = new BScriptRunner(this.cmdEnviroment, { silent: true, scopes: this.scopes, scopePathId: scopes[0].path })					
							scope0.Create(scopes[0].scopeScript, this.paths);
							const typeofValue = (await scope0.executer());
							if(typeofValue?.val) {
								const scope1 = new BScriptRunner(this.cmdEnviroment, { silent: true, scopes: this.scopes, scopePathId: scopes[1].path })					
								scope1.Create(scopes[1].scopeScript, this.paths);
								results.push((await scope1.executer()));
							} else {
								if(scopes?.[2]) 
									if(scopes[2].beforePath.includes("ELSE")){								
										const scope2 = new BScriptRunner(this.cmdEnviroment, { silent: true, scopes: this.scopes, scopePathId: scopes[2].path })					
										scope2.Create(scopes[2].scopeScript, this.paths);
										results.push((await scope2.executer()));
									}
							}
							continue;
		    			}
		    			if(!isArg) {
							const bScriptRunner = new BScriptRunner(this.cmdEnviroment, { silent: true, scopes: this.scopes, scopePathId: scopes[0].path })					
							bScriptRunner.Create(scopes[0].scopeScript, this.paths);
			    			if(isFunc){
			    				const value = { type: "func", name: assignment, val: bScriptRunner.executer };
			    				if(value)
			    					results.push(value);
		    					if(assignment) {    				
			    					this.setValueToScope(assignment, value, this.scopePathId??"root");
			    				}
			    			}
			    			else {
			    				const executer = !isText ? isAsync ? bScriptRunner.executer(): await bScriptRunner.executer() : null
			    				const value = isText ? { type: "text", val: this.UnFormateScopes(scopes[0].scopeScript) }: isNum ? { type: "number", val: Number(scopes[0].scopeScript) } : isAsync ? { type: "promise", val: executer } : executer?.type == "func" ? { ...executer, name: assignment } : executer
			    				results.push(value);
		    					if(assignment) {    	
			    					this.setValueToScope(assignment, value, this.scopePathId??"root");
			    				}
			    				if(isText)
			    					continue;
			    			}
			    			if(!isText)
								continue;	
		    			}
		    		} 
		    		if(quotes) {
		    			results = [...results, ...quotes.map(quote=>({type: "text", val: quote.quoteText}))];
		    			continue;
		    		} 			
		    		try {
		    			function argType(arg, _browser=0) {
		    				if(Array.isArray(arg)) {
		    					const val = arg.map(x=>argType(x, ++_browser))
		    					return { type: "array", val }
		    				}
		    				return arg? !arg?.type && !arg?.val? { type: "RAW", val: arg } : arg : null
		    			}

		    			let args = frameScript.split(" ");
		    			const commandName = args[0].replace(" ");
		    			args.shift();
		    			for(let i = 0; i < args.length; i++) {
		    				const scopes = this.scriptPathFinder(args[i], 'scope');
		    				if(!scopes){
		    					args[i] = argType(args[i])
		    					continue;
		    				}
		    				const bScriptRunner = new BScriptRunner(this.cmdEnviroment, { silent: true, scopes: this.scopes, scopePathId: scopes[0].path })					
							bScriptRunner.Create(scopes[0].scopeScript, this.paths);
		    				const arg = await bScriptRunner.executer();
		    				if(arg)
		    					args[i] = argType(arg)
		    			}
		    			if(this.commandExist(commandName)) {	    				
		    				let value;
		    				if(value = await this.commandExecute.bind(this)({ commandName, args, options: this.options })){
		    					results.push(value);
		    				}
		    			}
		    			else{
		    				throw new Error(`Command by name "${commandName}" not found!`)
		    			}
		    		} catch(e) {
						await this.cmdEnviroment.commandController.Print(e.message.replace("\n", ""));
					}
		    	}
		    }
	    	return results.length == 0? 
	    		null
	    	: results.length > 1 ?
	    		{ type: "array", val: results }
	    	: results[0];
    	}
	}
}