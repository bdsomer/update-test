#!/usr/bin/env node

const dirname = process.cwd()
const { spawn } = require('child_process')
const { join } = require('path')
const readFile = require('util').promisify(require('fs').readFile)

/**
 * Logs a message.
 * @param {String} type The type of message to log, ex. 'Info' or 'Fatal'.
 * @param {String} msg The message to log.
 */
function log(type, msg) {
	console.log(`[\x1b[36m${type}\x1b[0m] ${msg}`)
}

/**
 * Spawns a child process.
 * @param {String} cmd The command to run.
 * @param {String[]} args The arguments to pass to this command.
 * @return {Promise<Number>} Resolves with exit code if exit code is zero. Rejects with exit code if exit code is not zero.
 */
function spawnCp(cmd, args) {
	return new Promise((resolve, reject) => {
		const cp = spawn(cmd, args)

		cp.stdout.pipe(process.stdout)
		
		cp.on('close', (code) => {
			cp.stdout.unpipe(process.stdout)
			if (code === 0) {
				resolve(code)
			} else {
				reject(code)
			}
		})
	})
}

let passed = [ ]
let failed = [ ]

/**
 * Main function.
 */
async function main() {
	const dependencies = JSON.parse(await readFile(join(dirname, 'package-lock.json'))).dependencies
	if (!dependencies) {
		console.log('You don\'t have any dependencies to update! Wooho!')
		process.exit(0)
	}
	const deps = Object.keys(dependencies)
	const depInfo = (i) => dependencies[deps[i]]
	const testScript = JSON.parse(await readFile(join(dirname, 'package.json'))).scripts.test
	const testScriptArgs = testScript.split(' ')
	const testScriptCmd = testScriptArgs.splice(0, 1)[0]

	for (let i = 0; i < deps.length; i++) {
		const dependency = deps[i]

		log('Info', 'Installing latest version of ' + dependency + '...')
		await spawnCp('npm', ['i', dependency + '@latest'])
		log('Info', 'Running tests...')
		try {
			await spawnCp(testScriptCmd, testScriptArgs)
			passed.push(dependency)
			log('Info', 'Tests passed!')
		} catch (e) {
			failed.push(dependency)
			log('Info', 'Tests failed! Rolling back...')
			await spawnCp('npm', ['i', dependency + '@' + depInfo(i).version])
		}
	}

	console.log('\nTests passed for ' + passed.join(', '))
	console.log('Tests failed for ' + failed.join(', '))
	console.log('To update, run npm i ' + passed.map((el) => el + '@latest').join(' '))
}

main().then(() => {
	log('Success', 'Process completed successfully.')
}, (err) => {
	log('Fatal', 'Something went wrong :(')
	console.error(err)
})