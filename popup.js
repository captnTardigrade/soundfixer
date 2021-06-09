'use strict'

let tid = 0
const frameMap = new Map()
const elementsList = document.getElementById('elements-list')
const elementsTpl = document.getElementById('elements-tpl')

function applySettings (fid, elid, newSettings) {
	return browser.tabs.executeScript(tid, { frameId: fid, code: `(function () {
		const el = document.querySelector('[data-x-soundfixer-id="${elid}"]')
		if (!el.xSoundFixerContext) {
			el.xSoundFixerContext = new AudioContext()
			el.xSoundFixerGain = el.xSoundFixerContext.createGain()
			el.xSoundFixerPan = el.xSoundFixerContext.createStereoPanner()
			el.xSoundFixerSplit = el.xSoundFixerContext.createChannelSplitter(2)
			el.xSoundFixerMerge = el.xSoundFixerContext.createChannelMerger(2)
			el.xSoundFixerSource = el.xSoundFixerContext.createMediaElementSource(el)
			el.xSoundFixerSource.connect(el.xSoundFixerGain)
			el.xSoundFixerGain.connect(el.xSoundFixerPan)
			el.xSoundFixerPan.connect(el.xSoundFixerContext.destination)
			el.xSoundFixerOriginalChannels = el.xSoundFixerContext.destination.channelCount
		}
		const newSettings = ${JSON.stringify(newSettings)}
		if (newSettings.gain) {
			el.xSoundFixerGain.gain.value = newSettings.gain
		}
		if (newSettings.pan) {
			el.xSoundFixerPan.pan.value = newSettings.pan
		}
		if ('mono' in newSettings) {
			el.xSoundFixerContext.destination.channelCount = newSettings.mono ? 1 : el.xSoundFixerOriginalChannels
		}
		if ('flip' in newSettings) {
			el.xSoundFixerFlipped = newSettings.flip
			el.xSoundFixerMerge.disconnect()
			el.xSoundFixerPan.disconnect()
			if (el.xSoundFixerFlipped) {
				el.xSoundFixerPan.connect(el.xSoundFixerSplit)
				el.xSoundFixerSplit.connect(el.xSoundFixerMerge, 0, 1)
				el.xSoundFixerSplit.connect(el.xSoundFixerMerge, 1, 0)
				el.xSoundFixerMerge.connect(el.xSoundFixerContext.destination)
			} else {
				el.xSoundFixerPan.connect(el.xSoundFixerContext.destination)
			}
		}
		el.xSoundFixerSettings = {
			gain: el.xSoundFixerGain.gain.value,
			pan: el.xSoundFixerPan.pan.value,
			mono: el.xSoundFixerContext.destination.channelCount == 1,
			flip: el.xSoundFixerFlipped,
		}
	})()` })
}

browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
	tid = tabs[0].id
	return browser.webNavigation.getAllFrames({ tabId: tid }).then(frames =>
		Promise.all(frames.map(frame => {
			const fid = frame.frameId
			return browser.tabs.executeScript(tid, { frameId: fid, code: `(function () {
				const result = new Map()
				for (const el of document.querySelectorAll('video, audio')) {
					if (!el.hasAttribute('data-x-soundfixer-id')) {
						el.setAttribute('data-x-soundfixer-id',
							Math.random().toString(36).substr(2, 10))
					}
					result.set(el.getAttribute('data-x-soundfixer-id'), {
						type: el.tagName.toLowerCase(),
						settings: el.xSoundFixerSettings
					})
				}
				return result
			})()` }).then(result => frameMap.set(fid, result[0]))
			.catch(err => console.error(`tab ${tid} frame ${fid}`, err))
		}))
	)
}).then(_ => {
	elementsList.textContent = ''
	for (const [fid, els] of frameMap) {
		for (const [elid, el] of els) {
			const settings = el.settings || {}
			const node = document.importNode(elementsTpl.content, true)
			node.querySelector('.element-label').textContent = `${el.type} in frame ${fid}`
			const gain = node.querySelector('.element-gain')
			gain.value = settings.gain || 2
			gain.parentElement.querySelector('.target').textContent = '' + gain.value
			gain.addEventListener('change', _ => {
				applySettings(fid, elid, { gain: gain.value })
				gain.title = '' + gain.value
				gain.parentElement.querySelector('.target').textContent = '' + gain.value
			})
			const pan = node.querySelector('.element-pan')
			pan.value = settings.pan || 0
			pan.parentElement.querySelector('.target').textContent = '' + pan.value
			pan.addEventListener('change', _ => {
				applySettings(fid, elid, { pan: pan.value })
				pan.title = '' + pan.value
				pan.parentElement.querySelector('.target').textContent = '' + pan.value
			})
			const mono = node.querySelector('.element-mono')
			mono.checked = settings.mono || false
			mono.addEventListener('change', _ => {
				applySettings(fid, elid, { mono: mono.checked })
			})
			const flip = node.querySelector('.element-flip')
			flip.checked = settings.flip || false
			flip.addEventListener('change', _ => {
				applySettings(fid, elid, { flip: flip.checked })
			})
			elementsList.appendChild(node)
		}
	}
	if (elementsList.innerHTML === '') {
		elementsList.innerHTML = '<li>No audio/video found in the current tab. Note that some websites do not work because of cross-domain security restrictions.</li>'
	}
})
