### vue 组件示例代码

如果组件是 `image-picker`, 示例代码如下:

vue3 示例代码:
```vue
<template>
  <div>
    <input type="file" @change="handleImageSelected" />
  </div>
</template>

<script setup lang="ts">
const handleImageSelected = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    console.log(file);
  }
};
</script>

<style lang="scss" scoped>
.image-picker {
  width: 100%;
  height: 100%;
}
</style>
```

vue2 示例代码:
```vue
<template>
  <div>
    <input type="file" @change="handleImageSelected" />
  </div>
</template>

<script>
export default {
  name: 'ImagePicker',
  props: {
    ....
  },
  data() {
    return {
      image: null,
    };
  },
  methods: {
    handleImageSelected(event) {
      const file = event.target.files[0];
      if (file) {
        this.image = file;
      }
    },
  },
};
</script>
<style lang="scss" scoped>
.image-picker {
  width: 100%;
  height: 100%;
}
```