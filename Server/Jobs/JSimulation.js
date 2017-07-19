import Job from './Job.js'
import { SimController } from '../Sim'
import fs from 'fs'
module.exports = class JSimulation extends Job {
  constructor (data) {
    super(data)
    this.id = data.id || null
    this.env = data.env || null
    this.gen = data.gen.JPath || null
    this.sche = data.sche.JPath || null
    this.sim = data.sim.JPath || null
    this.plat = data.plat.JPath || null
    this.argu = data.argu || null
  }

  static onProcess (job, done) {
    const d = job.data
    const sim = SimController.simulate(d.env, d.gen, d.sche, d.sim, d.plat, d.argu)

    let result = { type: null, msg: '' }
    const killer = Job.setKiller(sim, job.data.ttl, result)
    sim.stdout.pipe(fs.createWriteStream(`./Server/home/darg/log/${d.id}.out.log`))
    sim.stderr.pipe(fs.createWriteStream(`./Server/home/darg/log/${d.id}.err.log`))

    sim.on('exit', (code) => {
      Job.clearKiller(killer)
      if (code === 0) {
        done(null, result)
      } else {
        done(`Exit with ${code}. Msg:\n${result.msg}`)
      }
    })
  }

  getData () {
    return {
      id: this.id,
      env: this.env,
      gen: this.gen,
      sche: this.sche,
      sim: this.sim,
      plat: this.plat,
      argu: this.argu,
      ttl: this.ttl
    }
  }
}