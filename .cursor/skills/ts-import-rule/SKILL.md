---
name: ts-import-rule
description: TypeScript导入规则, 适用于TypeScript项目, 导入文件时, 需要遵循的规则
---

##	import 严格排序
- npm 包（react、lodash 等） → 第 1 类
- @/xxx 这类 alias → 第 2 类
- 相对路径 ../ / ./ → 第 3 类

##	import type 必须和普通 import 分开
import type 必须和普通 import 分开, 例如:

```ts
import type { ReactNode } from 'react';
import { ReactNode } from 'react';
```

## 正确的示例:

```ts
import React from 'react';
import { useMemo } from 'react';
import clsx from 'clsx';

import type { FC } from 'react';
import type { User } from '@/types/user';

import { Button } from '@/components/Button';
import { fetchUser } from '@/services/user';

import { formatDate } from '../utils/date';
import './index.css';
```