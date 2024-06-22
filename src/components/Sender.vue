<template>
  <el-upload v-model:file-list="fileList" drag :auto-upload="false" :limit="1">
    <el-icon class="el-icon--upload"><upload-filled /></el-icon>
    <div class="el-upload__text">Drop file here or <em>click to upload</em></div>
    <template #tip>
      <div class="el-upload__tip">jpg/png files with a size less than 500kb</div>
    </template>
  </el-upload>

  <el-button type="primary" @click="handleChange">上传 {{ sentSize }} / {{ fileSize }}</el-button>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { UploadFilled } from '@element-plus/icons-vue';
import type { UploadUserFile } from 'element-plus';
import { useFileStore } from '@/stores/file';

const fileStore = useFileStore();
const fileList = ref<UploadUserFile[]>([]);
// 创建 RTCPeerConnection 对象
const peerConnection = new RTCPeerConnection({
  iceServers: [
    {
      urls: ['stun:stun.otakutools.cn:3478'],
    },
  ],
});
const fileSize = ref(0);
const sentSize = ref(0);

// 创建数据通道
const dataChannel = peerConnection.createDataChannel('myDataChannel', { ordered: true });

const handleChange = () => {
  const file = fileList.value[0].raw;
  if (file) {
    fileSize.value = file.size;
    fileStore.send({ type: 'info', fileName: file.name, fileSize: file.size });
  }
};

const beginSend = () => {
  const file = fileList.value[0].raw;
  if (!file) return;

  const CHUNK_SIZE = 16384;
  let offset = 0;
  const reader = new FileReader();

  const readSlice = () => {
    const slice = file?.slice(offset, offset + CHUNK_SIZE);
    reader.readAsArrayBuffer(slice);
  };

  reader.onload = (e) => {
    const buffer = e.target?.result as ArrayBuffer;
    if (buffer) {
      dataChannel.send(buffer);
      offset += buffer.byteLength;
      sentSize.value = offset;

      if (offset < fileSize.value) {
        readSlice();
      }
    }
  };

  readSlice();
};

// 监听数据通道上的消息
dataChannel.onmessage = (event) => {
  console.log('Received message from remote: ', event.data);
};

// 监听数据通道打开事件
dataChannel.onopen = () => {
  console.log('Data channel is open!');
};

// 监听ICE candidate事件
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    fileStore.send({ id: 1, candidate: event.candidate });
  }
};

// 创建并设置offer
peerConnection.onnegotiationneeded = async () => {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    fileStore.send({ type: 'offer', sdp: offer.sdp });
  } catch (error) {
    console.error('Error creating offer:', error);
  }
};

// 监听answer
fileStore.onmessage(async (event: any) => {
  if (event.data.type === 'answer') {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: event.data.sdp,
      }),
    );
  } else if (event.data.candidate && event.data.id === 2) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(event.data.candidate));
  } else if (event.data.type === 'ready') {
    beginSend();
  }
});
</script>
