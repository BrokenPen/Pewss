import fs from 'fs';

module.exports = class FileManager{

	static async scanDirRecursive(dirPath, files){
		files = files || [];
		let entries = [];

		await this.scanDir(dirPath).then((_entries) => {
			entries = _entries;
		}).catch((err) => {
			throw err;
		});

		for(let name of entries){
			const path = `${dirPath}/${name}`;
			await this.isDir(path).then(async (isDir) => {
				if(isDir)
					await this.scanRecursive(path ,files);
				else
					files.push({name, path});
			}).catch((err) => {
				throw err;
			});
		}
		
		return files;
	}

	static scanDir(path){
		return new Promise((res, rej) => {
			fs.readdir(path, (err, files) => {
				if(err)
					rej(err);
				else
					res(files);
			});
		});
	};

	static stat(path){
		return new Promise((res, rej) => {
			fs.stat(path, (err, stat) => {
				if(err)
					rej(err);
				else
					res(stat);
			});
		});
	}

	static async isDir(path){
		let stat = null;
		await this.stat(path).then((_stat) => {
			stat = _stat;
		}).catch((err) => {
			throw err;
		});

		return stat.isDirectory();
	};

	static deleteFile(path){
		return new Promise((res, rej) => {
			fs.unlink(path, (err) => {
				if(err)
					rej(err);
				else 
					res();
			});
  		});
	}

	static writeFile(path, content){
		return new Promise((res, rej) => {
			fs.writeFile(path, content, (err) => {
				if(err)
					rej(err);
				else 
					res();
			});
		});
	}
}