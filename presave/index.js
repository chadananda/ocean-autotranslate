module.exports = presave

function presave(html, opt) {
	opt = opt || {}
	console.log("Applying presave modifier", opt);
	var res = html.replace(/ALTLANG/g, opt.language)

	return res
}

