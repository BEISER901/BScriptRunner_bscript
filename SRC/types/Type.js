module.exports = class Type {
	constructor(options) {
		if(!options?.type) {
			options = { 
				type: "RAW",
				val: options
			}
		}
		Object.keys(options).map(key => {
			this[key] = options[key];options
		})
	}
	GetDisplayType() {
		return this?.type
			? 
				( 
					this.type == "func"?
						`[FUNC${this?.name ? "-"+this.name : ""}]`
					: 
					this.type == "promise"?
						`{PROMISE}`
					:
					this.type == "text"?
						`${this.val}`
					:
					this.type == "number"?
						`${this.val}`
					:
					this.type == "bool"?
						`[${this.val == 1? "TRUE": "FALSE"}]`
					:
					this.type == "array"?
						`[ARRAY(${this.val.length}){${this.val.map(x=>x.GetDisplayType())}}]`
					: 
					this.type == "jstype"?
						this.val
					:
					this.type == "object"?
						Object.keys(this.val).map(key=>{
							return `${key}:${this.val[key].GetDisplayType().split("\n").map(row=>"\n -- "+row).join("")}`
						}).join("\n")
					:
					this.type == "ref"?
						`[REF{${this.prop.join(".")}}{\n${this.get().GetDisplayType()}\n}]`
					:
						`[NOTYPE ${this.val}]`
				) 
			: 
		`[RAW ${this}]`
	}
}