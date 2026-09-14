import React, { useState, useEffect, useRef, useMemo } from 'react';

interface Article {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
}

interface CartItem {
  article: Article;
  quantity: number;
}