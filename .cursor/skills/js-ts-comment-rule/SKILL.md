---
name: frontend-comment-rule
description: 前端代码注释规则, 适用于前端项目, 注释时, 需要遵循的规则, 包含文件: js/ts/tsx/vue/html等文件
---

## 总体原则（必须遵守）

1. **注释是为“阅读者”服务，不是为代码本身服务**
2. **禁止无意义注释**
   - ❌ “赋值变量”
   - ❌ “调用函数”
3. **只在以下场景必须写注释**
   - 业务意图不直观
   - 与 UI / UX / 交互逻辑强相关
   - 有边界条件 / 副作用 / 特殊约束

---

### 1. JS/TS/TSX 文件函数/类 注释规则
- 1. 每个生成的函数, 都需要注释, 注释内容包括: 函数名称, 函数参数, 函数返回值, 函数描述等.
- 2. 每个生成的类, 都需要注释, 注释内容包括: 类名称, 类描述, 类属性, 类方法等.
- 3. 函数内部的实现, 按照功能/逻辑, 补充行内的注释, 重要的逻辑或者复杂的逻辑, 需要注释说明.
- 4. 如果是JS文件, 则需要生成JSDoc注释, 如果是TS文件, 则需要生成TSDoc注释.

行内注释example:

```ts
const add = (....): number => {
  // 计算两个数的和
  const result = a + b;

  // 计算宽高比
  const a = data.height;
  const b = data.width;
  const ratio = a / b;

  // 其他逻辑
};
```

### 2. vue/tsx/html 渲染部分的注释规则
- 1. 针对UI部分, html文件也需要注释, 注释规则按照 UI/UX 设计逻辑, 补充行内的注释
- 2. 针对某些组件/元素, 还需要补充额外的说明

参考如下:
```html
<template>
  <div>
    <!-- 图片选择器 -->
    <input type="file" @change="handleImageSelected" />
    <!-- 图片展示区域 -->
    <div class="image-preview">
      <img :src="image" />
    </div>

    <!-- TOAST 提示, 额外说明: 作用于 图片选择出错/成功的提示 -->
    <toast :message="toastMessage" />
  </div>
</template>
```

```tsx
const ImagePicker = () => {
  return (
    <div>
      {/* 图片选择器 */}
      <input type="file" @change="handleImageSelected" />
      {/* 图片展示区域 */}
      <div class="image-preview">
        <img :src="image" />
      </div>

      {/* TOAST 提示, 额外说明: 作用于 图片选择出错/成功的提示 */}
      <toast :message="toastMessage" />
      .........
    </div>
  );
};
```

```vue
<template>
  <div>
    <!-- 图片选择器 -->
    <input type="file" @change="handleImageSelected" />
    <!-- 图片展示区域 -->
    <div class="image-preview">
      <img :src="image" />
    </div>
    .....
  </div>
</template>
```