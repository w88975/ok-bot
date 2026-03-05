

### react 组件示例代码

如果组件是 `image-picker`, 示例代码如下:
```tsx
import { useState } from 'react';
import { View, Text, Button } from 'react-native';
// ....其他引入

type ImagePickerProps = {
  ....
};

/**
 * 图片选择器组件
 * @param props 组件属性
 * @returns 组件
 */
export const ImagePicker = (props: ImagePickerProps) => {
  const { .... } = props;

  return (
    <View>
      ....
    </View>
  );
};
```

如果组件有对外暴露的函数, 属性, 需要用 `forwardRef`, `useImperativeHandle` 等函数来实现, 例如:

```tsx
....
type ImagePickerRef = {
  open: () => void;
  close: () => void;
};

export const ImagePicker = forwardRef<ImagePickerRef, ImagePickerProps>((props, ref) => {
  const { .... } = props;

  useImperativeHandle(ref, () => ({
    open: () => {
      ....
    },
    close: () => {
      ....
    },
  }));

  return (
    <View>
      ....
    </View>
  );
});
