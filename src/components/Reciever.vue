<template>
  <div>
    <h3>{{ fileName }}</h3>
    <div>{{ receiveSize }} / {{ totalSize }}</div>
  </div>
</template>

<script setup lang="ts">
import { useFileStore } from '@/stores/file';
import { ref } from 'vue';

const fileStore = useFileStore();
// 创建 RTCPeerConnection 对象
const peerConnection = new RTCPeerConnection({
  iceServers: [
    {
      urls: ['stun:stun.otakutools.cn:3478'],
    },
  ],
});

let buffer: BlobPart[] = [];

const receiveSize = ref(0);
const totalSize = ref(0);
const fileName = ref('');

const receive = (e: MessageEvent<any>) => {
  buffer.push(e.data);
  receiveSize.value += e.data.byteLength;

  if (receiveSize.value === totalSize.value) {
    const blob = new Blob(buffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = fileName.value;
    a.click();
  }
};

// 监听数据通道上的消息
peerConnection.ondatachannel = (event) => {
  const dataChannel = event.channel;
  dataChannel.onmessage = (event) => {
    console.log('Received message from remote: ', event.data);
    receive(event);
  };

  dataChannel.onopen = () => {
    console.log('Data channel is open!');
  };

  dataChannel.onclose = () => {
    console.log('Data channel is closed!');
  };
};

// 监听ICE candidate事件
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    fileStore.send({ id: 2, candidate: event.candidate });
  }
};

// 监听offer
fileStore.onmessage(async (event: any) => {
  if (event.data.type === 'offer') {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: 'offer',
        sdp: event.data.sdp,
      }),
    );
    // 创建并设置answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    fileStore.send({ type: 'answer', sdp: answer.sdp });
  } else if (event.data.candidate && event.data.id === 1) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(event.data.candidate));
  } else if (event.data.type === 'info') {
    fileName.value = event.data.fileName;
    totalSize.value = event.data.fileSize;
    fileStore.send({ type: 'ready' });
  }
});
</script>
