import { writable, get } from "svelte/store";
import WaveSurfer from 'wavesurfer.js'
import Region from 'wavesurfer.js/dist/plugin/wavesurfer.regions.min.js'
import Tone from 'tone'

const synthLib = {
    'Synth': () => new Tone.PolySynth(4, Tone.Synth),
    'FMSynth': () => new Tone.PolySynth(4, Tone.FMSynth),
    'Sampler': () => new Tone.Sampler()
}


const scaleLib = {
    'Major': [0, 2, 4, 5, 7, 9, 11],
    'Minor': [0, 2, 3, 5, 7, 8, 10]
}

const toneLib = [
    'C', // 0
    'C#', // 1 
    'D', // 2
    'D#', // 3
    'E', // 4
    'F', // 5 
    'F#', // 6
    'G', // 7
    'G#', // 8
    'A', // 9
    'A#', // 10
    'B', // 11
]

const waveUI = writable({ instance: null, blob: null })

waveUI.init = (waveColor = 'red', sound, blob) => {
    waveUI.update(() => {
        return {
            instance: WaveSurfer.create({
                container: '#waveform',
                waveColor: waveColor,
                progressColor: 'transparent',
                hideScrollbar: true,
                interact: false,
                plugins: [Region.create({})],
            }),
        }
    })
    waveUI.initListeners(sound, blob)
}

waveUI.load = (blob, buffer) => {
    const wavesurfer = get(waveUI).instance
    wavesurfer.loadBlob(blob)
    waveUI.update(({ instance }) => (
        {
            instance,
            buffer,
            blob,
            reversed: false
        }
    ))
}

waveUI.updateReversed = (bool) => {
    waveUI.update(n => (
        {
            ...n,
            reversed: bool
        }
    ))
}

waveUI.reverse = (sound) => {
    const ui = get(waveUI)
    const { buffer, instance } = ui
    const { start, end } = instance.currentRegion
    if (!ui.reversed) {
        instance.loadDecodedBuffer(buffer.get())
        sound.add('C4', buffer.slice(start, end))
        waveUI.updateReversed(true)
        return
    }
    sound.add('C4', buffer.slice(start, end))
    instance.loadDecodedBuffer(buffer.get())
    waveUI.updateReversed(false)
}

waveUI.initListeners = (sound, color = 'hsla(400, 100%, 30%, 0.5)') => {
    const wavesurfer = get(waveUI).instance
    console.log(wavesurfer)
    wavesurfer.on('ready', e => {
        if (Object.keys(wavesurfer.regions.list).length === 0) {
            const region = wavesurfer.addRegion({
                start: 0,
                end: wavesurfer.getDuration(),
                color: color,
                minLength: 0,
                maxLength: wavesurfer.getDuration(),
            })
            region.initialWidth = region.element.clientWidth
            region.on('update-end', e => {
                const { buffer } = get(waveUI)
                let { start, end } = region
                
                if (start < 0) {
                    start = 0
                    region.start = 0
                }
                if (end > buffer.duration || end <= start) {
                    end = buffer.duration
                    region.end = buffer.duration
                }
                if (start > end || end < start) {
                    start = 0
                    region.start = 0
                    end = buffer.duration
                    region.end = buffer.duration
                    
                }
                if (region.element.clientWidth < 10) {
                    console.log('HERE')
                    region.element.style.width = region.initialWidth + 'px'
                    region.element.style.left = '0px'
                    console.log(region.element.style.width)
                }
                sound.add('C4', buffer.slice(start, end))
                wavesurfer.currentRegion = region
            })
            console.log(region)
            region.on('out', e => {
                console.log(e)
            })
            wavesurfer.currentRegion = region
        }
    })
}

const generateScale = (tone, scale) => {
    const toneRef = [...toneLib]
    const scaleRef = {...scaleLib}
    const index = toneRef.indexOf(tone)
    const firstSlice = toneRef.slice(0, index)
    const secondSlice = toneRef.splice(index)
    const tones = [...secondSlice, ...firstSlice]
    return scaleRef[scale].map(interval => tones[interval])
}

const scaleToPadMap = (scale, octave) => {
    // Esta funcion es mejorable
    let shouldContinueLow = false
    let shouldContinueHigh = false
    const low = scale.map((note, index) => {
        if (note === 'C' || note === 'C#' && scale[index - 1] === 'B' || shouldContinueLow) {
            shouldContinueLow = true
            return `${note}${octave + 1}`
        }
        return `${note}${octave}`
    })
    const high = scale.map((note, index) => {
        if (note === 'C' || note === 'C#' && scale[index - 1] === 'B' || shouldContinueHigh) {
            // 420
            shouldContinueHigh = true
            return `${note}${octave + 2}`
        }
        return `${note}${octave + 1}`
    })
    high.push(high[0])
    low.push(low[0])
    return [...low, ...high]
}

const bootstrap = () => {
    const maxVoices = 4
    const pads = []
    for (let i = 1; i <= 16; i++) {
        pads.push({ id: i, active: false })
    }
    const sounds = initSounds()
    const patterns = initPatterns()
    const data = {
        pads,
        sounds: {
            value: sounds,
        },
        patterns: {
            value: patterns
        },
        currentSound: {
            value: 1
        },
        currentPattern: {
            value: 1
        },
        mode: {
            value: 'sound',
        },
        currentNote: {
            value: 'C5',
        },
        willChangeCurrent: {
            value: false
        }
    }
    data.currentNote.update = note => {
        data.currentNote.value = note
        notify('currentNote', data.currentNote)
    }
    data.mode.update = (mode) => {
        if (mode === 'sound') {
            data.mode.value = 'pattern'
            notify('mode', data.mode)
            return
        }
        data.mode.value = 'sound'
        notify('mode', data.mode)
    }
    data.sounds.update = (id, { tone, scale, synth, type }) => {
        if (scale) {
            data.sounds.value[id].scale = scale
        }
        if (tone) {
            data.sounds.value[id].tone = tone
        }
        if (synth) {
            data.sounds.value[id].type = type
            data.sounds.value[id].synth = synthLib[synth]()
        }
        notify('sounds', data.sounds)
    }
    data.patterns.update = (step, note) => {
        const sound = sounds[data.currentSound.value]
        const indexedStep = step === 0 ? 0 : step - 1
        const ref = data.patterns.value[data.currentPattern.value][indexedStep]
        // erase step
        if (!note) {
            const pop = ref.filter(step => step.sound !== data.currentSound.value)
            data.patterns.value[data.currentPattern.value][indexedStep] = pop
            notify('patterns', data.patterns)
            return
        }
        // write step
        if (ref.length < maxVoices) {
            ref.push({
                note,
                synth: sound.synth,
                sound: data.currentSound.value,
            })
            data.patterns.value[data.currentPattern.value][indexedStep] = ref
            notify('patterns', data.patterns)
            return
        }
    }
    data.currentSound.update = n => {
        data.currentSound.value = n
        notify('currentSound', data.currentSound)
    }
    data.currentPattern.update = n => {
        data.currentPattern.value = n
        notify('currentPattern', data.currentPattern)
    }
    data.willChangeCurrent.update = (val) => {
        if (
            (val === 'sound' && data.willChangeCurrent.value === 'sound') ||
            (val === 'pattern' && data.willChangeCurrent.value === 'pattern')
        ) {
            data.willChangeCurrent.value = false
            notify('willChangeCurrent', data.willChangeCurrent)
            return
        }
        data.willChangeCurrent.value = val
        notify('willChangeCurrent', data.willChangeCurrent)
    }
    return data
}

const notifier = writable(null)
const notify = (type, value) => {
    notifier.update(() => {
        return {
            type, value
        }
    })
}

const initPatterns = () => {
    const n = {}
    // Buen sitio para buscar en memoria
    for (let i = 1; i <= 16; i++) {
        // Crea el pattern
        n[i] = []
        for (let j = 0; j <= 15; j++) {
            // Crea el step
            n[i][j] = []
        }
    }
    return n
}

const initSounds = () => {
    let n = {}
    for (let i = 1; i <= 16; i++) {
        // Este es un buen sitio para cargar datos de memoria
        // Si encuentra datos, propiedad con los datos si no, null
        n[i] = {}
        n[i].octave = 3
        n[i].tone = 'C'
        n[i].scale = 'Major'
        n[i].loop = false
        // Creates an instance of the synth engine
        n[i].type = 'Synth'
        n[i].synth = synthLib['Synth']()
    }
    return n
}

export {
    bootstrap,
    generateScale,
    scaleToPadMap,
    synthLib,
    toneLib,
    scaleLib,
    notifier,
    waveUI
}