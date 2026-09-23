import { configure } from '@testing-library/react'

// Yük altındaki makinede React Query'nin ilk verisi RTL'in 1 sn'lik
// varsayılanını aşabiliyor; findBy* sorgularına daha geniş pencere verilir.
configure({ asyncUtilTimeout: 5000 })
