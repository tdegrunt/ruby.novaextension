class RubyLanguageServer {
	constructor() {
		// Observe the configuration setting for the server's location, and restart the server on change
		nova.config.observe('ruby.language-server-path', function(path) {
			this.start(path);
		}, this);
	}
	
	get isBundled() {
		if (typeof this._isBundled !== "undefined") {
			return Promise.resolve(this._isBundled);
		}

		if (!(nova.workspace.contains("Gemfile") || nova.workspace.contains("gems.rb") || nova.workspace.contains("bin/bundle"))) {
			this._isBundled = false;
			return Promise.resolve(false);
		}
		
		return new Promise(resolve => {
			const process = new Process("bin/bundle", {
				args: ["exec", "solargraph", "--version"],
				cwd: nova.workspace.path,
				shell: true
			});
			

			let output = "";
			process.onStdout(line => output += line.trim());
			process.onDidExit(status => {
				if (status === 0) {
					console.log(`Found Solargraph ${output} (Bundled)`);
					resolve(this._isBundled = true);
				} else {
					resolve(this._isBundled = false);
				}
			});

			process.start();
		});
	}

	get isGlobal() {
		if (typeof this._isGlobal !== "undefined") {
			return Promise.resolve(this._isGlobal);
		}

		return new Promise(resolve => {
			const process = new Process("/usr/bin/env", {
				args: ["solargraph", "--version"],
				cwd: nova.workspace.path,
				shell: true
			});

			let output = "";
			process.onStdout(line => output += line.trim());
			process.onDidExit(status => {
				if (status === 0) {
					console.log(`Found Solargraph ${output} (Global)`);
					resolve(this._isGlobal = true);
				} else {
					resolve(this._isGlobal = false);
				}
			});

			process.start();
		});
	}

	async commandArgs(commandArguments) {
		if (await this.isBundled) {
			commandArguments.unshift(nova.workspace.path+"/bin/bundle", "exec");
		} else if (!(await this.isGlobal)) {
			this.notifyUserOfMissingCommand();
			return false;
		}

		commandArguments.unshift("/usr/bin/env");
		const args = commandArguments;
		return args;
	}
	
	notifyUserOfMissingCommand() {
		if (this.isNotified) return;

		const request = new NotificationRequest("solargraph-not-found");
		request.title = nova.localize("Solargraph Not Found");
		request.body = nova.localize("The \"solargraph\" command could not be found in your environment.");
		request.actions = [nova.localize("OK"), nova.localize("Help")];

		const notificationPromise = nova.notifications.add(request);
		notificationPromise.then((response) => {
			if (response.actionIdx === 1) { // Help
				nova.openConfig();
			}
		}).catch((error) => {
			console.error(error);
		}).finally(() => {
			this.isNotified = true;
		});
	}
	
	deactivate() {
		this.stop();
	}
	
	async start(path) {
		if (this.languageClient) {
			this.languageClient.stop();
			nova.subscriptions.remove(this.languageClient);
		}
		
		// Use the default server path
		if (!path) {
			path = nova.workspace.path+'/bin/bundle';
		}
		
		const defaultArguments = ["solargraph", "stdio"];
		const allArgs = await this.commandArgs(defaultArguments);
		if (!allArgs) return;
		
		// Create the client
		var serverOptions = {
			path: allArgs.shift(),
			args: allArgs,
			type: "stdio"
		};
		var clientOptions = {
			// The set of document syntaxes for which the server is valid
			syntaxes: ['ruby']
		};
		var client = new LanguageClient('ruby', 'Ruby Language Server', serverOptions, clientOptions);
		
		try {
			// Start the client
			client.start();
			
			// Add the client to the subscriptions to be cleaned up
			nova.subscriptions.add(client);
			this.languageClient = client;
		}
		catch (err) {
			// If the .start() method throws, it's likely because the path to the language server is invalid
			
			if (nova.inDevMode()) {
				console.error(err);
			}
		}
	}
	
	stop() {
		if (this.languageClient) {
			this.languageClient.stop();
			nova.subscriptions.remove(this.languageClient);
			this.languageClient = null;
		}
	}
}

module.exports = RubyLanguageServer;
