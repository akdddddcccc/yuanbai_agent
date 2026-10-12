import React from 'react';
import {createRoot} from 'react-dom/client';
import {SchoolPortal} from './SchoolPortal.jsx';
// 顺序有意义：先载入原站视觉，再用学校样式覆盖布局；不修改共享样式文件。
import '../src/styles.css';
import './school.css';
createRoot(document.getElementById('root')).render(<SchoolPortal/>);
