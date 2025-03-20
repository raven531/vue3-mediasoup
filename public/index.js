if (location.href.substr(0, 5) !== 'https') location.href = 'https' + location.href.substr(4, location.href.length - 4)

const socket = io()

let producer = null

nameInput.value = 'user_' + Math.round(Math.random() * 1000)

socket.request = function request(type, data = {}) {
  return new Promise((resolve, reject) => {
    socket.emit(type, data, (data) => {
      if (data.error) {
        reject(data.error)
      } else {
        resolve(data)
      }
    })
  })
}

let rc = null

function joinRoom(name, room_id) {
  if (rc && rc.isOpen()) {
    console.log('Already connected to a room')
  } else {
    initEnumerateDevices()

    rc = new RoomClient(localMedia, remoteVideos, remoteAudios, window.mediasoupClient, socket, room_id, name, roomOpen)

    addListeners()
  }
}

function roomOpen() {
  login.className = 'hidden'
  reveal(startAudioButton)
  hide(stopAudioButton)
  reveal(startVideoButton)
  hide(stopVideoButton)
  reveal(startScreenButton)
  hide(stopScreenButton)
  reveal(exitButton)
  reveal(copyButton)
  reveal(devicesButton)
  control.className = ''
  reveal(videoMedia)
}

function hide(elem) {
  elem.className = 'hidden'
}

function reveal(elem) {
  elem.className = ''
}

function addListeners() {
  rc.on(RoomClient.EVENTS.startScreen, () => {
    hide(startScreenButton)
    reveal(stopScreenButton)
  })

  rc.on(RoomClient.EVENTS.stopScreen, () => {
    hide(stopScreenButton)
    reveal(startScreenButton)
  })

  rc.on(RoomClient.EVENTS.stopAudio, () => {
    hide(stopAudioButton)
    reveal(startAudioButton)
  })
  rc.on(RoomClient.EVENTS.startAudio, () => {
    hide(startAudioButton)
    reveal(stopAudioButton)
  })

  rc.on(RoomClient.EVENTS.startVideo, () => {
    hide(startVideoButton)
    reveal(stopVideoButton)
  })
  rc.on(RoomClient.EVENTS.stopVideo, () => {
    hide(stopVideoButton)
    reveal(startVideoButton)
  })
  rc.on(RoomClient.EVENTS.exitRoom, () => {
    hide(control)
    hide(devicesList)
    hide(videoMedia)
    hide(copyButton)
    hide(devicesButton)
    reveal(login)
  })
}

let isEnumerateDevices = false

function initEnumerateDevices() {
  // Many browsers, without the consent of getUserMedia, cannot enumerate the devices.
  if (isEnumerateDevices) return

  try {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        enumerateDevices()
        stream.getTracks().forEach(function (track) {
          track.stop()
        })
      })
      .catch((err) => {
        console.error('Access denied for audio/video: ', err)
        enumerateDevices()
      })
  } catch (error) {
    console.error('Error accessing media devices', error)
  }
}

function enumerateDevices() {
  // Load mediaDevice options
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    audioSelect.innerHTML = ''
    videoSelect.innerHTML = ''

    // Create 'None' options
    const audioNoneOption = document.createElement('option')
    audioNoneOption.value = 'none'
    audioNoneOption.text = 'None (Disabled)'
    audioSelect.appendChild(audioNoneOption)

    const videoNoneOption = document.createElement('option')
    videoNoneOption.value = 'none'
    videoNoneOption.text = 'None (Disabled)'
    videoSelect.appendChild(videoNoneOption)

    let countAudio = 0
    let countVideo = 0

    devices.forEach((device) => {
      if (device.kind === 'audioinput') {
        const option = document.createElement('option')
        option.value = device.deviceId
        option.text = device.label || `Microphone ${countAudio + 1}`
        audioSelect.appendChild(option)
        countAudio++
      } else if (device.kind === 'videoinput') {
        const option = document.createElement('option')
        option.value = device.deviceId
        option.text = device.label || `Camera ${countVideo + 1}`
        videoSelect.appendChild(option)
        countVideo++
      }
    })

    // Select first real device by default (index 1 to skip 'None')
    if (countAudio > 0) {
      audioSelect.selectedIndex = 1
    }
    if (countVideo > 0) {
      videoSelect.selectedIndex = 1
    }

    isEnumerateDevices = true
  })
}
